import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateEmplacementCode } from "@/lib/ids";

const STATUSES = ["ACTIVE", "INACTIVE", "FERMEE", "SUSPENDUE", "EN_ATTENTE_DE_VALIDATION"];

export async function listBusinesses(user: CurrentUser) {
  return prisma.business.findMany({
    where: recordScopeWhere(user),
    include: { owner: true, arrondissement: true, quartier: true, activityRef: true, _count: { select: { payments: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getBusiness(user: CurrentUser, id: string) {
  const business = await prisma.business.findUnique({
    where: { id },
    include: { owner: true, arrondissement: true, quartier: true, activityRef: true, obligations: true, payments: { orderBy: { paymentDate: "desc" }, take: 20 } },
  });
  if (!business) throw new ApiError(404, "Boutique/commerce introuvable.");
  if (!canAccessArrondissement(user, business.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");
  return business;
}

export type CreateBusinessInput = {
  name: string;
  ownerId: string;
  activity?: string;
  activityId?: string | null;
  category?: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  photoUrl?: string | null;
  arrondissementId: string;
  quartierId?: string | null;
};

// Boutique/commerce de quartier (section 8). Le code d'emplacement structure
// (section 7, ex NDJ-A01-Q05-BT-000123) est genere apres l'insertion, une
// fois le compteur `sequence` attribue par Postgres — jamais recalcule ni
// reutilise ensuite.
export async function createBusiness(actor: CurrentUser, input: CreateBusinessInput) {
  if (!can(actor, "businesses", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.name?.trim() || !input.ownerId) throw new ApiError(400, "Nom et proprietaire requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }

  const arrondissement = await prisma.arrondissement.findUnique({ where: { id: input.arrondissementId } });
  if (!arrondissement) throw new ApiError(400, "Arrondissement invalide.");
  const quartier = input.quartierId ? await prisma.quartier.findUnique({ where: { id: input.quartierId } }) : null;

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.business.create({
      data: {
        name: input.name.trim(),
        ownerId: input.ownerId,
        activity: input.activity?.trim(),
        activityId: input.activityId || null,
        category: input.category?.trim(),
        gpsLat: input.gpsLat ?? null,
        gpsLng: input.gpsLng ?? null,
        photoUrl: input.photoUrl?.trim() || null,
        arrondissementId: input.arrondissementId,
        quartierId: input.quartierId || null,
      },
    });
    const code = generateEmplacementCode({
      arrondissementNumber: arrondissement.number,
      quartierCode: quartier?.code,
      typeCode: "BT",
      sequence: row.sequence,
    });
    return tx.business.update({ where: { id: row.id }, data: { code } });
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "businesses",
    entityType: "Business",
    entityId: created.id,
    arrondissementId: created.arrondissementId,
    newValue: { name: created.name, code: created.code },
  });
  return created;
}

export type UpdateBusinessInput = Partial<{
  name: string;
  activity: string;
  activityId: string | null;
  category: string;
  gpsLat: number | null;
  gpsLng: number | null;
  photoUrl: string | null;
}>;

export async function updateBusiness(actor: CurrentUser, id: string, input: UpdateBusinessInput) {
  if (!can(actor, "businesses", "edit")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.business.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Boutique/commerce introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");

  const updated = await prisma.business.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      activity: input.activity?.trim(),
      activityId: input.activityId,
      category: input.category?.trim(),
      gpsLat: input.gpsLat,
      gpsLng: input.gpsLng,
      photoUrl: input.photoUrl?.trim(),
    },
  });

  await logAudit({
    user: actor,
    action: "UPDATE",
    module: "businesses",
    entityType: "Business",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { name: before.name },
    newValue: { name: updated.name },
  });
  return updated;
}

// status: ACTIVE | INACTIVE | FERMEE | SUSPENDUE | EN_ATTENTE_DE_VALIDATION
export async function setBusinessStatus(actor: CurrentUser, id: string, status: string) {
  if (!can(actor, "businesses", "edit")) throw new ApiError(403, "Permission insuffisante.");
  if (!STATUSES.includes(status)) throw new ApiError(400, "Statut invalide.");
  const before = await prisma.business.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Boutique/commerce introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");

  const updated = await prisma.business.update({
    where: { id },
    data: {
      status,
      closedAt: status === "FERMEE" ? new Date() : before.closedAt,
      openedAt: before.openedAt ?? (status === "ACTIVE" ? new Date() : null),
    },
  });

  await logAudit({
    user: actor,
    action: "UPDATE",
    module: "businesses",
    entityType: "Business",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status },
  });
  return updated;
}
