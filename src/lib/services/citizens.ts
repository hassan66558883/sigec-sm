import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

export async function listCitizens(user: CurrentUser, search?: string) {
  return prisma.citizen.findMany({
    where: {
      ...recordScopeWhere(user),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { uniqueNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { arrondissement: true, quartier: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// Rapport (section 31) : meme perimetre territorial + recherche optionnelle,
// plafond plus haut que listCitizens() (ecrans admin/recherche terrain).
export async function listCitizensForReport(user: CurrentUser, search?: string) {
  return prisma.citizen.findMany({
    where: {
      ...recordScopeWhere(user),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { uniqueNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { arrondissement: true, quartier: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
}

export async function getCitizen(user: CurrentUser, id: string) {
  const citizen = await prisma.citizen.findUnique({
    where: { id },
    include: {
      arrondissement: true,
      quartier: true,
      sector: true,
      household: true,
      father: true,
      mother: true,
      childrenAsFather: true,
      childrenAsMother: true,
      marriagesAsHusband: { include: { wife: true } },
      marriagesAsWife: { include: { husband: true } },
    },
  });
  if (!citizen) throw new ApiError(404, "Citoyen introuvable.");
  if (!canAccessArrondissement(user, citizen.arrondissementId)) {
    throw new ApiError(403, "Citoyen hors de votre perimetre.");
  }
  return citizen;
}

export type CreateCitizenInput = {
  firstName: string;
  lastName: string;
  sex: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  phone?: string;
  address?: string;
  arrondissementId: string;
  quartierId?: string | null;
  sectorId?: string | null;
  householdId?: string | null;
  fatherId?: string | null;
  motherId?: string | null;
};

export async function createCitizen(actor: CurrentUser, input: CreateCitizenInput) {
  if (!can(actor, "citizens", "create")) throw new ApiError(403, "Permission insuffisante.");
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  if (!firstName || !lastName) throw new ApiError(400, "Nom et prenom requis.");
  if (input.sex !== "M" && input.sex !== "F") throw new ApiError(400, "Sexe invalide (M ou F).");
  if (!input.arrondissementId) throw new ApiError(400, "Arrondissement requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }

  const created = await prisma.citizen.create({
    data: {
      uniqueNumber: generateRecordNumber("CIT"),
      firstName,
      lastName,
      sex: input.sex,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      placeOfBirth: input.placeOfBirth?.trim(),
      nationality: input.nationality?.trim() || "Tchadienne",
      phone: input.phone?.trim(),
      address: input.address?.trim(),
      arrondissementId: input.arrondissementId,
      quartierId: input.quartierId || null,
      sectorId: input.sectorId || null,
      householdId: input.householdId || null,
      fatherId: input.fatherId || null,
      motherId: input.motherId || null,
    },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "citizens",
    entityType: "Citizen",
    entityId: created.id,
    arrondissementId: created.arrondissementId,
    newValue: { uniqueNumber: created.uniqueNumber, firstName, lastName },
  });

  return created;
}

export type UpdateCitizenInput = Partial<{
  phone: string;
  address: string;
  placeOfBirth: string;
  photoUrl: string;
}>;

// Modification d'une fiche contribuable/citoyen deja recensee (module
// recensement, section 4 : "modifier contribuable selon permissions").
// Ne touche jamais a uniqueNumber, arrondissement/quartier/secteur de
// rattachement ni au lien de filiation — une reaffectation territoriale est
// une operation distincte, hors scope de cette simple mise a jour de fiche.
export async function updateCitizen(actor: CurrentUser, id: string, input: UpdateCitizenInput) {
  if (!can(actor, "citizens", "edit")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.citizen.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Citoyen introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) {
    throw new ApiError(403, "Citoyen hors de votre perimetre.");
  }

  const updated = await prisma.citizen.update({
    where: { id },
    data: {
      phone: input.phone?.trim(),
      address: input.address?.trim(),
      placeOfBirth: input.placeOfBirth?.trim(),
      photoUrl: input.photoUrl?.trim(),
    },
  });

  await logAudit({
    user: actor,
    action: "UPDATE",
    module: "citizens",
    entityType: "Citizen",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { phone: before.phone, address: before.address },
    newValue: { phone: updated.phone, address: updated.address },
  });

  return updated;
}
