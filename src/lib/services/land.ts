import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

// Utilisee a la fois par la table de la page /admin/land ET comme source du
// selecteur "lotissement" dans ParcelForm sur la meme page — signature et
// forme de retour (tableau simple) volontairement inchangees pour ne pas
// casser l'API /api/land/subdivisions ni ce selecteur. La pagination reelle
// de la table vit dans listSubdivisionsPage() ci-dessous.
export async function listSubdivisions(user: CurrentUser) {
  return prisma.subdivision.findMany({
    where: recordScopeWhere(user),
    include: { arrondissement: true, _count: { select: { parcels: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const DEFAULT_PAGE_SIZE = 25;

// Pagination reelle cote base (skip/take + count) pour la table "Lotissements"
// de /admin/land uniquement (voir audit performance 2026-09-02 : au-dela des
// 100 premiers lotissements, aucune page cliquee dans le tableau ne les
// rendait jamais accessibles).
export async function listSubdivisionsPage(user: CurrentUser, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const where = recordScopeWhere(user);
  const [rows, total] = await Promise.all([
    prisma.subdivision.findMany({
      where,
      include: { arrondissement: true, _count: { select: { parcels: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subdivision.count({ where }),
  ]);
  return { rows, total, page, pageSize };
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

// Utilisee par la table de /admin/land ET par /api/land/parcels — signature
// et forme de retour inchangees ici ; pagination reelle dans
// listParcelsPage() ci-dessous.
export async function listParcels(user: CurrentUser) {
  return prisma.landParcel.findMany({
    where: recordScopeWhere(user),
    include: { arrondissement: true, owner: true, title: true, subdivision: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// Pagination reelle cote base pour la table "Parcelles" de /admin/land.
export async function listParcelsPage(user: CurrentUser, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const where = recordScopeWhere(user);
  const [rows, total] = await Promise.all([
    prisma.landParcel.findMany({
      where,
      include: { arrondissement: true, owner: true, title: true, subdivision: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.landParcel.count({ where }),
  ]);
  return { rows, total, page, pageSize };
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
