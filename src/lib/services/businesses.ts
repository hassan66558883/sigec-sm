import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function listBusinesses(user: CurrentUser) {
  return prisma.business.findMany({
    where: recordScopeWhere(user),
    include: { owner: true, arrondissement: true, _count: { select: { payments: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createBusiness(
  actor: CurrentUser,
  input: { name: string; ownerId: string; activity?: string; arrondissementId: string; quartierId?: string | null },
) {
  if (!can(actor, "businesses", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.name?.trim() || !input.ownerId) throw new ApiError(400, "Nom et proprietaire requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }
  const created = await prisma.business.create({
    data: {
      name: input.name.trim(),
      ownerId: input.ownerId,
      activity: input.activity?.trim(),
      arrondissementId: input.arrondissementId,
      quartierId: input.quartierId || null,
    },
  });
  await logAudit({ user: actor, action: "CREATE", module: "businesses", entityType: "Business", entityId: created.id, arrondissementId: created.arrondissementId, newValue: { name: created.name } });
  return created;
}
