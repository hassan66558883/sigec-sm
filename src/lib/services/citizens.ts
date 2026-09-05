import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";
import { encryptField, decryptField } from "@/lib/encryption";
import { emitIntegrationEvent } from "@/lib/services/integration-webhooks";

// Utilisee a la fois par la page de liste des citoyens ET par ~10 pages de
// formulaires ailleurs (births, marriages, deaths, payments...) pour peupler
// des selecteurs "choisir un citoyen" — signature/forme de retour (tableau
// simple) volontairement inchangee ici pour ne pas casser ces appelants.
// La pagination reelle de l'ecran de liste vit dans listCitizensPage()
// ci-dessous, une fonction dediee.
export async function listCitizens(user: CurrentUser, search?: string) {
  const rows = await prisma.citizen.findMany({
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
  return rows.map((r) => ({ ...r, phone: decryptField(r.phone) }));
}

const DEFAULT_PAGE_SIZE = 25;

// Pagination reelle cote base (skip/take + count) pour l'ecran de liste
// /admin/citizens uniquement : avant ce changement, les citoyens au-dela des
// 100 premiers (par date de creation) n'etaient jamais accessibles, quelle
// que soit la page cliquee dans le tableau (voir audit performance
// 2026-09-02) — `listCitizens()` ci-dessus plafonnait a `take: 100` sans
// `skip`, et la pagination du tableau ne faisait que re-decouper ce meme lot
// de 100 lignes cote client.
export async function listCitizensPage(user: CurrentUser, search?: string, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const where = {
    ...recordScopeWhere(user),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { uniqueNumber: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.citizen.findMany({
      where,
      include: { arrondissement: true, quartier: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.citizen.count({ where }),
  ]);
  return { rows: rows.map((r) => ({ ...r, phone: decryptField(r.phone) })), total, page, pageSize };
}

// Rapport (section 31) : meme perimetre territorial + recherche optionnelle,
// plafond plus haut que listCitizens() (ecrans admin/recherche terrain).
export async function listCitizensForReport(user: CurrentUser, search?: string) {
  const rows = await prisma.citizen.findMany({
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
  return rows.map((r) => ({ ...r, phone: decryptField(r.phone) }));
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
  return { ...citizen, phone: decryptField(citizen.phone) };
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
      phone: encryptField(input.phone?.trim()),
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

  await emitIntegrationEvent("citizen.created", {
    id: created.id,
    uniqueNumber: created.uniqueNumber,
    firstName,
    lastName,
    arrondissementId: created.arrondissementId,
  });

  return { ...created, phone: decryptField(created.phone) };
}

export type UpdateCitizenInput = Partial<{
  phone: string;
  address: string;
  placeOfBirth: string;
  photoUrl: string;
  // Optionnel pour ne pas casser un appelant existant qui ne l'envoie pas
  // encore (aucun formulaire client ne consomme ce PATCH aujourd'hui — voir
  // audit performance/concurrence 2026-09-02) ; a fournir des qu'un
  // formulaire d'edition existe, en le pre-remplissant avec
  // citizen.updatedAt.toISOString() au chargement du formulaire.
  expectedUpdatedAt: string;
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
  // Verrouillage optimiste (section concurrence, audit 2026-09-02) : sans
  // cette verification, deux agents ouvrant la meme fiche se voyaient
  // ecraser silencieusement l'un l'autre — le second "save" gagnait
  // toujours, sans avertissement. `updatedAt` sert de numero de version
  // implicite ; pas de colonne dediee necessaire.
  if (input.expectedUpdatedAt && before.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    throw new ApiError(409, "Cette fiche a ete modifiee par un autre utilisateur entre-temps. Rechargez avant de reessayer.");
  }

  const updated = await prisma.citizen.update({
    where: { id },
    data: {
      // input.phone === undefined doit laisser le champ inchange (mise a
      // jour partielle) : encryptField(undefined) renvoie null, ce qui
      // effacerait le numero a chaque appel ne le fournissant pas — d'ou
      // la distinction explicite ici plutot qu'un simple encryptField(...).
      phone: input.phone !== undefined ? encryptField(input.phone.trim()) : undefined,
      address: input.address?.trim(),
      placeOfBirth: input.placeOfBirth?.trim(),
      photoUrl: input.photoUrl?.trim(),
    },
  });

  // Le numero de telephone n'est jamais journalise en clair ni chiffre dans
  // l'audit log (meme convention que DeathRecord.cause) : un blob chiffre
  // n'y serait pas plus lisible, et le stocker en clair contournerait le
  // chiffrement applicatif.
  await logAudit({
    user: actor,
    action: "UPDATE",
    module: "citizens",
    entityType: "Citizen",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { address: before.address },
    newValue: { address: updated.address },
  });

  return { ...updated, phone: decryptField(updated.phone) };
}
