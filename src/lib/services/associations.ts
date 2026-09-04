import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

// Utilisee par la page /admin/associations ET par /api/associations —
// signature et forme de retour inchangees ici ; pagination reelle dans
// listAssociationsPage() ci-dessous.
export async function listAssociations(user: CurrentUser) {
  return prisma.association.findMany({
    where: recordScopeWhere(user),
    include: { leader: true, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const DEFAULT_PAGE_SIZE = 25;

// Pagination reelle cote base (skip/take + count) pour l'ecran de liste
// /admin/associations uniquement (voir audit performance 2026-09-02).
export async function listAssociationsPage(user: CurrentUser, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const where = recordScopeWhere(user);
  const [rows, total] = await Promise.all([
    prisma.association.findMany({
      where,
      include: { leader: true, arrondissement: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.association.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

export async function createAssociation(
  actor: CurrentUser,
  input: { name: string; type?: string; leaderId?: string | null; arrondissementId: string },
) {
  if (!can(actor, "associations", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.name?.trim()) throw new ApiError(400, "Nom requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }
  const created = await prisma.association.create({
    data: {
      registrationNumber: generateRecordNumber("ASS"),
      name: input.name.trim(),
      type: input.type?.trim(),
      leaderId: input.leaderId || null,
      arrondissementId: input.arrondissementId,
    },
  });
  await logAudit({ user: actor, action: "CREATE", module: "associations", entityType: "Association", entityId: created.id, arrondissementId: created.arrondissementId, newValue: { name: created.name } });
  return created;
}

export async function setAssociationStatus(actor: CurrentUser, id: string, status: string) {
  if (!can(actor, "associations", "edit")) throw new ApiError(403, "Permission insuffisante.");
  const validStatuses = ["REGISTERED", "SUSPENDED", "DISSOLVED"];
  if (!validStatuses.includes(status)) throw new ApiError(400, "Statut invalide.");
  const before = await prisma.association.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Association introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) {
    throw new ApiError(403, "Association hors de votre perimetre.");
  }
  const updated = await prisma.association.update({ where: { id }, data: { status } });
  await logAudit({ user: actor, action: "UPDATE", module: "associations", entityType: "Association", entityId: id, arrondissementId: before.arrondissementId, oldValue: { status: before.status }, newValue: { status } });
  return updated;
}
