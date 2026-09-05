import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { generateApiKeyMaterial, hashApiKey } from "@/lib/integration/gateway";
import type { CurrentUser } from "@/lib/auth";

// Scopes disponibles (section 18) — un systeme externe ne doit avoir acces
// qu'aux ressources dont il a reellement besoin. Cette liste couvre les
// endpoints /api/v1/* reellement exposes en Phase 1 (voir app/api/v1/) ;
// elle s'etoffera au meme rythme que de nouveaux endpoints seront ajoutes.
export const AVAILABLE_SCOPES = ["citizens:read", "documents:verify"] as const;

// Credentials sensibles (cles API completes, secrets clients) : reservees
// aux administrateurs autorises (section 31, integration.credentials) —
// distinct de integration.view (metadonnees non sensibles : nom, type,
// statut d'un systeme).
function requireCredentialsPermission(actor: CurrentUser) {
  if (!can(actor, "integration", "credentials")) throw new ApiError(403, "Permission insuffisante.");
}

export async function listApiKeys(actor: CurrentUser) {
  requireCredentialsPermission(actor);
  return prisma.integrationApiKey.findMany({
    orderBy: { createdAt: "desc" },
    include: { system: { select: { id: true, name: true, code: true } } },
  });
}

export type CreateApiKeyInput = { name: string; systemId?: string | null; scopes: string[]; expiresAt?: Date | null };

// Le secret brut n'est renvoye qu'ICI, au moment de la creation — jamais
// relisible ensuite (ni par l'API ni par l'interface), meme convention que
// les codes de secours MFA (section 17 : "ne jamais afficher les secrets en
// clair apres leur enregistrement").
export async function createApiKey(actor: CurrentUser, input: CreateApiKeyInput) {
  requireCredentialsPermission(actor);
  const invalidScopes = input.scopes.filter((s) => !AVAILABLE_SCOPES.includes(s as (typeof AVAILABLE_SCOPES)[number]));
  if (invalidScopes.length > 0) throw new ApiError(400, `Scope(s) invalide(s): ${invalidScopes.join(", ")}`);
  if (input.systemId) {
    const system = await prisma.integrationSystem.findUnique({ where: { id: input.systemId } });
    if (!system) throw new ApiError(404, "Systeme introuvable.");
  }

  const { raw, keyPrefix } = generateApiKeyMaterial();
  const keyHash = await hashApiKey(raw);

  const created = await prisma.integrationApiKey.create({
    data: {
      name: input.name,
      systemId: input.systemId ?? null,
      keyPrefix,
      keyHash,
      scopes: input.scopes,
      expiresAt: input.expiresAt ?? null,
      createdById: actor.id,
    },
  });

  await logAudit({ user: actor, action: "API_KEY_CREATED", module: "integration", entityType: "IntegrationApiKey", entityId: created.id, newValue: { name: created.name, scopes: created.scopes, systemId: created.systemId } });

  return { id: created.id, rawKey: raw, keyPrefix, name: created.name, scopes: created.scopes, expiresAt: created.expiresAt };
}

export async function revokeApiKey(actor: CurrentUser, id: string) {
  requireCredentialsPermission(actor);
  const key = await prisma.integrationApiKey.findUnique({ where: { id } });
  if (!key) throw new ApiError(404, "Cle API introuvable.");
  const updated = await prisma.integrationApiKey.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date() } });
  await logAudit({ user: actor, action: "API_KEY_REVOKED", module: "integration", entityType: "IntegrationApiKey", entityId: id, newValue: { name: key.name } });
  return updated;
}

// Revoque la cle existante et en cree une nouvelle avec les memes nom/
// systeme/scopes — jamais une reactivation de l'ancien secret (une cle
// tournee doit invalider l'ancien secret immediatement).
export async function rotateApiKey(actor: CurrentUser, id: string) {
  requireCredentialsPermission(actor);
  const key = await prisma.integrationApiKey.findUnique({ where: { id } });
  if (!key) throw new ApiError(404, "Cle API introuvable.");

  await prisma.integrationApiKey.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date() } });

  const { raw, keyPrefix } = generateApiKeyMaterial();
  const keyHash = await hashApiKey(raw);
  const created = await prisma.integrationApiKey.create({
    data: { name: key.name, systemId: key.systemId, keyPrefix, keyHash, scopes: key.scopes, expiresAt: key.expiresAt, createdById: actor.id },
  });

  await logAudit({ user: actor, action: "API_KEY_ROTATED", module: "integration", entityType: "IntegrationApiKey", entityId: created.id, oldValue: { previousKeyId: id }, newValue: { name: created.name } });

  return { id: created.id, rawKey: raw, keyPrefix, name: created.name, scopes: created.scopes, expiresAt: created.expiresAt };
}
