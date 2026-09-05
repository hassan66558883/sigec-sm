import { generateSecret, verify, generateURI } from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { can } from "@/lib/rbac";
import { encryptField, decryptField } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth";

// Authentification a deux facteurs (module securite, section 2) — TOTP
// (RFC 6238), compatible avec toute application authenticator standard
// (Google Authenticator, Authy, 1Password...). Portee volontairement
// limitee aux comptes agents/administrateurs (User) pour cette phase, pas
// au portail citoyen : c'est la protection des comptes a privileges qui est
// visee (section 24, protection des administrateurs), pas l'authentification
// grand public.
const ISSUER = "SIGEC-SM";
const BACKUP_CODE_COUNT = 10;

// otplib.verify() leve une exception (TokenLengthError) plutot que de
// renvoyer simplement { valid: false } des que le jeton ne fait pas
// exactement 6 chiffres — donc jamais appelable directement avec un code de
// secours (10 caracteres hexadecimaux). Ce garde-fou evite l'appel dans ce
// cas, sans jamais avoir a distinguer nous-memes un "vrai" mauvais code TOTP
// d'un jeton de mauvais format : les deux doivent simplement echouer.
function looksLikeTotp(code: string): boolean {
  return /^\d{6}$/.test(code);
}

// Le secret TOTP doit rester utilisable (jamais hache comme un mot de
// passe : il faut pouvoir recalculer le code attendu a chaque verification),
// donc chiffre au repos (AES-256-GCM, voir lib/encryption.ts, section 32)
// plutot que stocke en clair.
export async function beginMfaSetup(actor: CurrentUser) {
  const existing = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (existing.mfaEnabled) throw new ApiError(400, "Le MFA est deja active sur ce compte.");

  // Stocke immediatement (chiffre) mais mfaEnabled reste false tant que
  // confirmMfaSetup() n'a pas verifie un premier code reel — une
  // configuration commencee puis abandonnee ne protege jamais un compte par
  // erreur, et n'empeche pas non plus la connexion normale entre-temps.
  const secret = generateSecret();
  await prisma.user.update({ where: { id: actor.id }, data: { mfaSecret: encryptField(secret) } });

  const otpauthUri = generateURI({ issuer: ISSUER, label: actor.email, secret });
  const qrDataUrl = await QRCode.toDataURL(otpauthUri);
  return { secret, qrDataUrl };
}

export async function confirmMfaSetup(actor: CurrentUser, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (user.mfaEnabled) throw new ApiError(400, "Le MFA est deja active sur ce compte.");
  if (!user.mfaSecret) throw new ApiError(400, "Aucune configuration MFA en attente. Recommencez.");

  if (!looksLikeTotp(code)) throw new ApiError(400, "Code invalide.");
  const secret = decryptField(user.mfaSecret)!;
  const result = await verify({ secret, token: code });
  if (!result.valid) throw new ApiError(400, "Code invalide.");

  // Codes de secours (perte/vol de l'appareil authenticator) : generes une
  // seule fois, affiches en clair une seule fois a l'appelant, stockes
  // uniquement sous forme de hash (meme convention que les mots de passe —
  // jamais besoin de les relire en clair, seulement de verifier une
  // correspondance).
  const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () => randomBytes(5).toString("hex"));
  const hashedCodes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));

  await prisma.user.update({
    where: { id: actor.id },
    data: { mfaEnabled: true, mfaEnabledAt: new Date(), mfaBackupCodes: hashedCodes },
  });

  await logAudit({ user: actor, action: "MFA_ENABLED", module: "auth", entityType: "User", entityId: actor.id });

  return backupCodes;
}

// Utilise a la fois pour la 2e etape de connexion et pour
// l'auto-desactivation (qui doit reprouver le facteur avant de le retirer) —
// jamais pour l'activation initiale, qui exige confirmMfaSetup() ci-dessus
// pour ne jamais activer un secret que l'utilisateur n'a pas reellement
// configure. Un code de secours est consomme des son utilisation (usage
// unique, retire immediatement du tableau).
export async function verifyMfaCode(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaEnabled || !user.mfaSecret) return false;

  if (looksLikeTotp(code)) {
    const secret = decryptField(user.mfaSecret)!;
    const result = await verify({ secret, token: code });
    if (result.valid) return true;
  }

  for (let i = 0; i < user.mfaBackupCodes.length; i++) {
    if (await bcrypt.compare(code, user.mfaBackupCodes[i])) {
      const remaining = [...user.mfaBackupCodes];
      remaining.splice(i, 1);
      await prisma.user.update({ where: { id: userId }, data: { mfaBackupCodes: remaining } });
      await logAudit({
        user: { id: user.id, name: user.name },
        action: "MFA_BACKUP_CODE_USED",
        module: "auth",
        entityType: "User",
        entityId: userId,
      });
      return true;
    }
  }
  return false;
}

export async function disableMfaSelf(actor: CurrentUser, code: string) {
  const ok = await verifyMfaCode(actor.id, code);
  if (!ok) throw new ApiError(400, "Code invalide.");
  await prisma.user.update({ where: { id: actor.id }, data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] } });
  await logAudit({ user: actor, action: "MFA_DISABLED", module: "auth", entityType: "User", entityId: actor.id });
}

// Voie de recuperation pour un utilisateur ayant perdu l'acces a son
// authenticator ET a ses codes de secours — meme logique que
// resetUserPasswordByAdmin() (section 19) : sans capacite d'envoi d'email,
// un administrateur doit pouvoir intervenir manuellement. Retire
// completement la configuration (l'utilisateur doit la refaire de zero a la
// prochaine connexion), jamais une simple desactivation temporaire.
export async function disableMfaByAdmin(actor: CurrentUser, targetId: string) {
  if (!can(actor, "users", "edit")) throw new ApiError(403, "Permission insuffisante.");
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw new ApiError(404, "Utilisateur introuvable.");

  await prisma.user.update({ where: { id: targetId }, data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] } });
  await logAudit({
    user: actor,
    action: "MFA_DISABLED_BY_ADMIN",
    module: "users",
    entityType: "User",
    entityId: targetId,
    newValue: { email: target.email },
  });
}
