import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

export async function listSubdivisions(user: CurrentUser) {
  return prisma.subdivision.findMany({
    where: recordScopeWhere(user),
    include: { arrondissement: true, _count: { select: { parcels: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createSubdivision(
  actor: CurrentUser,
  input: { name: string; zone?: string; description?: string; arrondissementId: string },
) {
  if (!can(actor, "land", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.name?.trim()) throw new ApiError(400, "Nom du projet requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }
  const created = await prisma.subdivision.create({
    data: {
      name: input.name.trim(),
      zone: input.zone?.trim(),
      description: input.description?.trim(),
      arrondissementId: input.arrondissementId,
    },
  });
  await logAudit({ user: actor, action: "CREATE", module: "land", entityType: "Subdivision", entityId: created.id, arrondissementId: created.arrondissementId, newValue: created });
  return created;
}

export async function listParcels(user: CurrentUser) {
  return prisma.landParcel.findMany({
    where: recordScopeWhere(user),
    include: { arrondissement: true, owner: true, title: true, subdivision: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export type CreateParcelInput = {
  arrondissementId: string;
  quartierId?: string | null;
  sectorId?: string | null;
  subdivisionId?: string | null;
  area?: number;
  location?: string;
  ownerCitizenId?: string | null;
};

export async function createParcel(actor: CurrentUser, input: CreateParcelInput) {
  if (!can(actor, "land", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.arrondissementId) throw new ApiError(400, "Arrondissement requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }
  const created = await prisma.landParcel.create({
    data: {
      parcelNumber: generateRecordNumber("PAR"),
      arrondissementId: input.arrondissementId,
      quartierId: input.quartierId || null,
      sectorId: input.sectorId || null,
      subdivisionId: input.subdivisionId || null,
      area: input.area,
      location: input.location?.trim(),
      ownerCitizenId: input.ownerCitizenId || null,
      status: input.ownerCitizenId ? "OCCUPIED" : "AVAILABLE",
    },
  });
  await logAudit({ user: actor, action: "CREATE", module: "land", entityType: "LandParcel", entityId: created.id, arrondissementId: created.arrondissementId, newValue: { parcelNumber: created.parcelNumber } });
  return created;
}

// Emission d'un titre foncier (section 8). Un seul titre actif par parcelle
// dans ce modele simplifie — la parcelle passe au statut TITLED.
export async function issueLandTitle(actor: CurrentUser, input: { parcelId: string; holderId: string }) {
  if (!can(actor, "land", "issue_title")) throw new ApiError(403, "Permission insuffisante.");
  const parcel = await prisma.landParcel.findUnique({ where: { id: input.parcelId }, include: { title: true } });
  if (!parcel) throw new ApiError(404, "Parcelle introuvable.");
  if (!canAccessArrondissement(actor, parcel.arrondissementId)) {
    throw new ApiError(403, "Parcelle hors de votre perimetre.");
  }
  if (parcel.title) throw new ApiError(409, "Cette parcelle possede deja un titre actif.");

  const [title] = await prisma.$transaction([
    prisma.landTitle.create({
      data: { titleNumber: generateRecordNumber("TF"), parcelId: input.parcelId, holderId: input.holderId },
    }),
    prisma.landParcel.update({ where: { id: input.parcelId }, data: { status: "TITLED", ownerCitizenId: input.holderId } }),
  ]);

  await logAudit({ user: actor, action: "CREATE", module: "land", entityType: "LandTitle", entityId: title.id, arrondissementId: parcel.arrondissementId, newValue: { titleNumber: title.titleNumber } });
  return title;
}
