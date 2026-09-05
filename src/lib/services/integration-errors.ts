import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { testIntegrationSystemConnection } from "@/lib/services/integration-systems";
import type { CurrentUser } from "@/lib/auth";

const PAGE_SIZE = 25;

export async function listIntegrationErrorsPage(actor: CurrentUser, status?: string, page = 1) {
  if (!can(actor, "integration", "logs")) throw new ApiError(403, "Permission insuffisante.");
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([
    prisma.integrationError.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { system: { select: { name: true, code: true } } },
    }),
    prisma.integrationError.count({ where }),
  ]);
  return { rows, total, page, pageSize: PAGE_SIZE };
}

// Phase 1 : seule une erreur de type CONNECTION_TEST_FAILED a un chemin de
// retry reel (re-tenter le Test Connection sur le systeme concerne). Les
// rejets de la gateway (auth/scope/quota) ne se "retentent" pas — ce sont
// des faits acquis sur une requete passee, pas une operation reprise-able ;
// ils restent consultables/ignorables/resolvables mais jamais "reessayes".
export async function retryIntegrationError(actor: CurrentUser, id: string) {
  if (!can(actor, "integration", "retry")) throw new ApiError(403, "Permission insuffisante.");
  const error = await prisma.integrationError.findUnique({ where: { id } });
  if (!error) throw new ApiError(404, "Erreur introuvable.");
  if (error.errorType !== "CONNECTION_TEST_FAILED" || !error.systemId) {
    throw new ApiError(400, "Ce type d'erreur ne peut pas etre reessaye automatiquement.");
  }

  await prisma.integrationError.update({ where: { id }, data: { status: "RETRYING", retryCount: { increment: 1 } } });
  const result = await testIntegrationSystemConnection(actor, error.systemId);

  const updated = await prisma.integrationError.update({
    where: { id },
    data: result.ok ? { status: "RESOLVED", resolvedAt: new Date(), resolvedById: actor.id } : { status: "FAILED" },
  });

  await logAudit({ user: actor, action: "INTEGRATION_ERROR_RETRIED", module: "integration", entityType: "IntegrationError", entityId: id, newValue: { ok: result.ok } });
  return updated;
}

export async function resolveIntegrationError(actor: CurrentUser, id: string) {
  if (!can(actor, "integration", "retry")) throw new ApiError(403, "Permission insuffisante.");
  const error = await prisma.integrationError.findUnique({ where: { id } });
  if (!error) throw new ApiError(404, "Erreur introuvable.");
  const updated = await prisma.integrationError.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: actor.id } });
  await logAudit({ user: actor, action: "INTEGRATION_ERROR_RESOLVED", module: "integration", entityType: "IntegrationError", entityId: id });
  return updated;
}

export async function ignoreIntegrationError(actor: CurrentUser, id: string) {
  if (!can(actor, "integration", "retry")) throw new ApiError(403, "Permission insuffisante.");
  const error = await prisma.integrationError.findUnique({ where: { id } });
  if (!error) throw new ApiError(404, "Erreur introuvable.");
  const updated = await prisma.integrationError.update({ where: { id }, data: { status: "IGNORED" } });
  await logAudit({ user: actor, action: "INTEGRATION_ERROR_IGNORED", module: "integration", entityType: "IntegrationError", entityId: id });
  return updated;
}
