import { prisma } from "@/lib/db";
import { getThresholds, raiseExcessiveLoginFailures } from "@/lib/services/fraud";

// Suivi des tentatives de connexion + verrouillage de compte (module
// securite, section 2). Distinct du rate-limit par IP existant
// (rate-limit.ts) : celui-ci est PAR EMAIL, independamment de l'IP
// d'origine — une attaque distribuee contre un seul compte depuis
// plusieurs IP contournerait sinon totalement la protection existante.
// Persiste en base (pas en memoire) : contrairement a rate-limit.ts, ce
// mecanisme survit un redemarrage et fonctionnerait correctement meme
// avec plusieurs instances applicatives (une vraie table, pas une Map).
export async function recordLoginAttempt(email: string, ipAddress: string | null, userAgent: string | null, success: boolean) {
  await prisma.loginAttempt.create({ data: { email: email.toLowerCase(), ipAddress, userAgent, success } });
}

// Compte les echecs recents pour CET email dans la fenetre configuree,
// mais UNIQUEMENT depuis la derniere connexion reussie le cas echeant : un
// succes prouve que l'utilisateur legitime a repris la main, il doit
// immediatement lever le verrouillage plutot que de le forcer a attendre
// la fin de la fenetre malgre un mot de passe correct. Sans succes recent,
// la fenetre seule sert de duree de verrouillage effective (voir
// commentaire sur loginLockoutWindowMinutes dans fraud.ts) : au-dela, le
// compte se deverrouille de lui-meme, sans etat "locked until" a gerer
// separement.
export async function isAccountLocked(email: string): Promise<boolean> {
  const thresholds = await getThresholds();
  const since = new Date(Date.now() - thresholds.loginLockoutWindowMinutes * 60 * 1000);
  const lastSuccess = await prisma.loginAttempt.findFirst({
    where: { email: email.toLowerCase(), success: true },
    orderBy: { createdAt: "desc" },
  });
  // gte (pas gt) sur lastSuccess.createdAt : createdAt n'a qu'une precision
  // milliseconde (TIMESTAMP(3)) — un echec pouvait, sous charge, partager
  // exactement le meme horodatage que le succes qui le precede de justesse
  // et se voir alors exclu a tort par un "gt" strict (bug constate : le
  // compteur restait sous le seuil alors qu'il aurait du le franchir). En
  // cas d'egalite reelle, compter l'echec comme posterieur au succes est le
  // choix le plus sur pour un mecanisme de securite (au pire un verrouillage
  // un cran plus tot que necessaire, jamais l'inverse).
  const recentFailures = await prisma.loginAttempt.count({
    where: {
      email: email.toLowerCase(),
      success: false,
      createdAt: lastSuccess ? { gte: since > lastSuccess.createdAt ? since : lastSuccess.createdAt } : { gte: since },
    },
  });
  if (recentFailures < thresholds.loginLockoutMaxAttempts) return false;

  // Signale une seule fois par episode de verrouillage, jamais a chaque
  // requete tant qu'il reste actif — un compte deja verrouille ne fait
  // JAMAIS avancer son propre compteur d'echecs (voir la route de login :
  // recordLoginAttempt() n'est pas appelee quand isAccountLocked() a deja
  // repondu true), donc recentFailures reste bloque pile au seuil tant que
  // dure le verrouillage. Comparer "=== seuil" ne suffit donc PAS a
  // detecter un nouveau franchissement — il faut verifier qu'aucune alerte
  // n'existe deja pour cet email dans la fenetre courante.
  const existingAlert = await prisma.fraudAlert.findFirst({
    where: { type: "EXCESSIVE_LOGIN_FAILURES", description: { contains: email.toLowerCase() }, createdAt: { gte: since } },
  });
  if (!existingAlert) {
    await raiseExcessiveLoginFailures(email, recentFailures);
  }
  return true;
}
