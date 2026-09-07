import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { encryptField } from "@/lib/encryption";
import { AVAILABLE_SCOPES } from "@/lib/services/integration-api-keys";
import type { CurrentUser } from "@/lib/auth";

export const SYSTEM_TYPES = [
  "GOVERNMENT", "BANK", "MOBILE_MONEY", "ERP", "POLICE", "JUSTICE", "HEALTH",
  "EDUCATION", "TAX", "TREASURY", "SMS", "EMAIL", "IDENTITY", "CADASTRE",
  "EXTERNAL_APPLICATION", "OTHER",
] as const;

export const SYSTEM_STATUSES = ["CONNECTED", "WARNING", "OFFLINE", "DISABLED", "TESTING"] as const;
export const ENVIRONMENTS = ["DEVELOPMENT", "STAGING", "PRODUCTION"] as const;
export const PROTOCOLS = ["REST", "SOAP"] as const;

export async function listIntegrationSystems(actor: CurrentUser) {
  if (!can(actor, "integration", "view")) throw new ApiError(403, "Permission insuffisante.");
  return prisma.integrationSystem.findMany({
    orderBy: { createdAt: "desc" },
    include: { credential: { select: { clientId: true } }, _count: { select: { apiKeys: true } } },
  });
}

export async function getIntegrationSystem(actor: CurrentUser, id: string) {
  if (!can(actor, "integration", "view")) throw new ApiError(403, "Permission insuffisante.");
  const system = await prisma.integrationSystem.findUnique({
    where: { id },
    include: { credential: { select: { clientId: true } }, apiKeys: true },
  });
  if (!system) throw new ApiError(404, "Systeme introuvable.");
  return system;
}

export type IntegrationSystemInput = {
  name: string;
  code: string;
  organization?: string | null;
  type: string;
  description?: string | null;
  baseUrl?: string | null;
  authType: string;
  protocol?: string;
  environment: string;
  contact?: string | null;
  rateLimitPerMinute?: number;
  clientId?: string | null;
  clientSecret?: string | null;
};

export async function createIntegrationSystem(actor: CurrentUser, input: IntegrationSystemInput) {
  if (!can(actor, "integration", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!SYSTEM_TYPES.includes(input.type as (typeof SYSTEM_TYPES)[number])) throw new ApiError(400, "Type de systeme invalide.");
  if (!ENVIRONMENTS.includes(input.environment as (typeof ENVIRONMENTS)[number])) throw new ApiError(400, "Environnement invalide.");
  if (input.protocol && !PROTOCOLS.includes(input.protocol as (typeof PROTOCOLS)[number])) throw new ApiError(400, "Protocole invalide.");

  const existing = await prisma.integrationSystem.findUnique({ where: { code: input.code } });
  if (existing) throw new ApiError(409, "Ce code systeme est deja utilise.");

  const system = await prisma.integrationSystem.create({
    data: {
      name: input.name,
      code: input.code,
      organization: input.organization ?? null,
      type: input.type,
      description: input.description ?? null,
      baseUrl: input.baseUrl ?? null,
      authType: input.authType,
      protocol: input.protocol ?? "REST",
      environment: input.environment,
      contact: input.contact ?? null,
      rateLimitPerMinute: input.rateLimitPerMinute ?? 100,
      createdById: actor.id,
    },
  });

  if (input.clientId || input.clientSecret) {
    await prisma.integrationCredential.create({
      data: {
        systemId: system.id,
        clientId: input.clientId ?? null,
        clientSecret: input.clientSecret ? encryptField(input.clientSecret) : null,
      },
    });
  }

  await logAudit({ user: actor, action: "INTEGRATION_SYSTEM_CREATED", module: "integration", entityType: "IntegrationSystem", entityId: system.id, newValue: { name: system.name, code: system.code, type: system.type } });
  return system;
}

export async function updateIntegrationSystem(actor: CurrentUser, id: string, input: Partial<IntegrationSystemInput>) {
  if (!can(actor, "integration", "update")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.integrationSystem.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Systeme introuvable.");

  const { clientId, clientSecret, ...systemFields } = input;
  const system = await prisma.integrationSystem.update({ where: { id }, data: systemFields });

  if (clientId !== undefined || clientSecret !== undefined) {
    await prisma.integrationCredential.upsert({
      where: { systemId: id },
      create: { systemId: id, clientId: clientId ?? null, clientSecret: clientSecret ? encryptField(clientSecret) : null },
      // Un clientSecret vide/absent dans la mise a jour NE l'efface PAS : ne
      // permet de le changer que s'il est explicitement fourni, jamais par
      // omission (evite d'effacer un secret existant par un formulaire qui ne
      // le renvoie jamais en clair apres coup, voir section 16).
      update: { ...(clientId !== undefined ? { clientId } : {}), ...(clientSecret ? { clientSecret: encryptField(clientSecret) } : {}) },
    });
  }

  await logAudit({ user: actor, action: "INTEGRATION_SYSTEM_UPDATED", module: "integration", entityType: "IntegrationSystem", entityId: id, oldValue: { name: before.name, status: before.status }, newValue: systemFields });
  return system;
}

export async function setIntegrationSystemEnabled(actor: CurrentUser, id: string, enabled: boolean) {
  if (!can(actor, "integration", "update")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.integrationSystem.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Systeme introuvable.");

  const system = await prisma.integrationSystem.update({
    where: { id },
    data: { enabled, status: enabled ? "TESTING" : "DISABLED" },
  });
  await logAudit({ user: actor, action: enabled ? "INTEGRATION_SYSTEM_ENABLED" : "INTEGRATION_SYSTEM_DISABLED", module: "integration", entityType: "IntegrationSystem", entityId: id, newValue: { enabled } });
  return system;
}

const TEST_TIMEOUT_MS = 5000;

// Verifie reellement la joignabilite du systeme (section 5 : "le systeme
// doit verifier la connexion avant de l'activer") — jamais un succes simule.
// Une requete HTTP reelle est tentee vers baseUrl ; toute reponse HTTP recue
// (meme 4xx/5xx) prouve que l'hote est joignable, seule une erreur reseau/
// timeout est traitee comme une vraie panne de connexion.
// Ping HTTP reel partage par le Test Connection manuel (ci-dessous) ET par
// le Health Monitoring periodique (integration-health.ts) — un seul et
// meme mecanisme de verification, jamais deux implementations qui
// pourraient diverger.
export async function pingUrl(url: string, timeoutMs = TEST_TIMEOUT_MS): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
    return { ok: true, message: `Reponse HTTP ${res.status} recue.`, latencyMs: Date.now() - start };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Echec de connexion.", latencyMs: Date.now() - start };
  }
}

export async function testIntegrationSystemConnection(actor: CurrentUser, id: string) {
  if (!can(actor, "integration", "test")) throw new ApiError(403, "Permission insuffisante.");
  const system = await prisma.integrationSystem.findUnique({ where: { id } });
  if (!system) throw new ApiError(404, "Systeme introuvable.");
  if (!system.baseUrl) throw new ApiError(400, "Aucune URL de base configuree pour ce systeme.");

  const { ok, message } = await pingUrl(system.baseUrl);

  const updated = await prisma.integrationSystem.update({
    where: { id },
    data: { lastTestAt: new Date(), lastTestOk: ok, lastTestMessage: message, status: ok ? "CONNECTED" : "OFFLINE" },
  });

  if (!ok) {
    await prisma.integrationError.create({
      data: { systemId: id, endpoint: system.baseUrl, errorType: "CONNECTION_TEST_FAILED", message },
    });
  }

  await logAudit({ user: actor, action: "INTEGRATION_TEST_CONNECTION", module: "integration", entityType: "IntegrationSystem", entityId: id, newValue: { ok, message } });
  return { ok, message, system: updated };
}

// OAuth2 client_credentials (section 16) — identifiants generes par
// SIGEC-SM (jamais choisis par l'admin) : le secret n'est renvoye qu'ICI,
// une seule fois, meme convention que les cles API (generateApiKeyMaterial)
// et les codes de secours MFA. Requiert authType=OAUTH2 : un systeme
// authentifie par cle API n'a pas besoin d'identifiants OAuth2 en plus.
export async function generateOAuthCredential(actor: CurrentUser, systemId: string, scopes: string[]) {
  if (!can(actor, "integration", "credentials")) throw new ApiError(403, "Permission insuffisante.");
  const system = await prisma.integrationSystem.findUnique({ where: { id: systemId } });
  if (!system) throw new ApiError(404, "Systeme introuvable.");
  if (system.authType !== "OAUTH2") throw new ApiError(400, "Ce systeme n'est pas configure en authType OAUTH2.");

  const invalidScopes = scopes.filter((s) => !AVAILABLE_SCOPES.includes(s as (typeof AVAILABLE_SCOPES)[number]));
  if (invalidScopes.length > 0) throw new ApiError(400, `Scope(s) invalide(s): ${invalidScopes.join(", ")}`);

  const clientId = `client_${randomBytes(8).toString("hex")}`;
  const clientSecret = randomBytes(24).toString("hex");

  await prisma.integrationCredential.upsert({
    where: { systemId },
    create: { systemId, clientId, clientSecret: encryptField(clientSecret), scopes },
    update: { clientId, clientSecret: encryptField(clientSecret), scopes },
  });

  await logAudit({ user: actor, action: "OAUTH_CREDENTIAL_GENERATED", module: "integration", entityType: "IntegrationSystem", entityId: systemId, newValue: { clientId, scopes } });

  return { clientId, clientSecret, scopes };
}

// Fait tourner uniquement le secret (le client_id reste stable — un
// systeme externe reconfigure son secret sans avoir a re-saisir son
// identifiant partout).
export async function rotateOAuthCredential(actor: CurrentUser, systemId: string) {
  if (!can(actor, "integration", "credentials")) throw new ApiError(403, "Permission insuffisante.");
  const credential = await prisma.integrationCredential.findUnique({ where: { systemId } });
  if (!credential?.clientId) throw new ApiError(404, "Aucun identifiant OAuth2 configure pour ce systeme.");

  const clientSecret = randomBytes(24).toString("hex");
  await prisma.integrationCredential.update({ where: { systemId }, data: { clientSecret: encryptField(clientSecret) } });

  await logAudit({ user: actor, action: "OAUTH_CREDENTIAL_ROTATED", module: "integration", entityType: "IntegrationSystem", entityId: systemId, newValue: { clientId: credential.clientId } });

  return { clientId: credential.clientId, clientSecret, scopes: credential.scopes };
}
