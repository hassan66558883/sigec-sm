import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { encryptField } from "@/lib/encryption";
import type { CurrentUser } from "@/lib/auth";

export const SYSTEM_TYPES = [
  "GOVERNMENT", "BANK", "MOBILE_MONEY", "ERP", "POLICE", "JUSTICE", "HEALTH",
  "EDUCATION", "TAX", "TREASURY", "SMS", "EMAIL", "IDENTITY", "CADASTRE",
  "EXTERNAL_APPLICATION", "OTHER",
] as const;

export const SYSTEM_STATUSES = ["CONNECTED", "WARNING", "OFFLINE", "DISABLED", "TESTING"] as const;
export const ENVIRONMENTS = ["DEVELOPMENT", "STAGING", "PRODUCTION"] as const;

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
export async function testIntegrationSystemConnection(actor: CurrentUser, id: string) {
  if (!can(actor, "integration", "test")) throw new ApiError(403, "Permission insuffisante.");
  const system = await prisma.integrationSystem.findUnique({ where: { id } });
  if (!system) throw new ApiError(404, "Systeme introuvable.");
  if (!system.baseUrl) throw new ApiError(400, "Aucune URL de base configuree pour ce systeme.");

  let ok: boolean;
  let message: string;
  try {
    const res = await fetch(system.baseUrl, { method: "GET", signal: AbortSignal.timeout(TEST_TIMEOUT_MS) });
    ok = true;
    message = `Reponse HTTP ${res.status} recue.`;
  } catch (error) {
    ok = false;
    message = error instanceof Error ? error.message : "Echec de connexion.";
  }

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
