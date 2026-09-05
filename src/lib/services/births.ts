import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";
import { periodBounds } from "@/lib/date-buckets";
import { detectDuplicateBirthRegistration } from "@/lib/services/fraud";

// KPI d'en-tete (tableau de bord Naissances, Phase 2) : compteurs
// aujourd'hui/semaine/mois/annee, meme convention que
// getFinanceSummary.byPeriod (src/lib/services/payments.ts).
export async function getBirthsPeriodStats(user: CurrentUser) {
  const scope = recordScopeWhere(user);
  const { startOfDay, startOfWeek, startOfMonth, startOfYear } = periodBounds();
  const [today, week, month, year] = await Promise.all([
    prisma.birthRecord.count({ where: { ...scope, createdAt: { gte: startOfDay } } }),
    prisma.birthRecord.count({ where: { ...scope, createdAt: { gte: startOfWeek } } }),
    prisma.birthRecord.count({ where: { ...scope, createdAt: { gte: startOfMonth } } }),
    prisma.birthRecord.count({ where: { ...scope, createdAt: { gte: startOfYear } } }),
  ]);
  return { today, week, month, year };
}

// Utilisee a la fois par la page de liste /admin/births ET par
// src/app/api/births/route.ts (GET) — signature/forme de retour (tableau
// simple) volontairement inchangee ici pour ne pas casser cet appelant. La
// pagination reelle de l'ecran de liste vit dans listBirthRecordsPage()
// ci-dessous, une fonction dediee.
export async function listBirthRecords(user: CurrentUser) {
  return prisma.birthRecord.findMany({
    where: recordScopeWhere(user),
    include: { child: true, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const DEFAULT_PAGE_SIZE = 25;

// Pagination reelle cote base (skip/take + count) pour l'ecran de liste
// /admin/births uniquement : avant ce changement, les declarations au-dela
// des 100 premieres (par date de creation) n'etaient jamais accessibles,
// quelle que soit la page cliquee dans le tableau (voir audit performance
// 2026-09-02) — `listBirthRecords()` ci-dessus plafonnait a `take: 100` sans
// `skip`.
export async function listBirthRecordsPage(user: CurrentUser, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const where = recordScopeWhere(user);
  const [rows, total] = await Promise.all([
    prisma.birthRecord.findMany({
      where,
      include: { child: true, arrondissement: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.birthRecord.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

// Rapport (section 31) : meme perimetre territorial, plafond plus haut que
// listBirthRecords() (reservee aux ecrans admin pagines).
export async function listBirthRecordsForReport(user: CurrentUser) {
  return prisma.birthRecord.findMany({
    where: recordScopeWhere(user),
    include: { child: true, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
}

export async function getBirthRecord(user: CurrentUser, id: string) {
  const record = await prisma.birthRecord.findUnique({
    where: { id },
    include: { child: { include: { father: true, mother: true } }, arrondissement: true, certificates: true },
  });
  if (!record) throw new ApiError(404, "Declaration de naissance introuvable.");
  if (!canAccessArrondissement(user, record.arrondissementId)) {
    throw new ApiError(403, "Dossier hors de votre perimetre.");
  }
  return record;
}

export type DeclareBirthInput = {
  childFirstName: string;
  childLastName: string;
  childSex: string;
  dateOfBirth: string;
  placeOfBirth: string;
  fatherId?: string | null;
  motherId?: string | null;
  declarantName: string;
  declarantRelation?: string;
  arrondissementId: string;
  quartierId?: string | null;
};

// Declare une naissance : cree le dossier citoyen de l'enfant + l'acte de
// naissance en statut DECLARED. La validation (enregistrement officiel) est
// une etape distincte, reservee a un role habilite (workflow section 17).
export async function declareBirth(actor: CurrentUser, input: DeclareBirthInput) {
  if (!can(actor, "births", "create")) throw new ApiError(403, "Permission insuffisante.");
  const childFirstName = input.childFirstName?.trim();
  const childLastName = input.childLastName?.trim();
  if (!childFirstName || !childLastName) throw new ApiError(400, "Nom et prenom de l'enfant requis.");
  if (input.childSex !== "M" && input.childSex !== "F") throw new ApiError(400, "Sexe invalide (M ou F).");
  if (!input.dateOfBirth || !input.placeOfBirth?.trim()) {
    throw new ApiError(400, "Date et lieu de naissance requis.");
  }
  if (!input.declarantName?.trim()) throw new ApiError(400, "Nom du declarant requis.");
  if (!input.arrondissementId) throw new ApiError(400, "Arrondissement requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }

  const record = await prisma.$transaction(async (tx) => {
    const child = await tx.citizen.create({
      data: {
        uniqueNumber: generateRecordNumber("CIT"),
        firstName: childFirstName,
        lastName: childLastName,
        sex: input.childSex,
        dateOfBirth: new Date(input.dateOfBirth),
        placeOfBirth: input.placeOfBirth.trim(),
        arrondissementId: input.arrondissementId,
        quartierId: input.quartierId || null,
        fatherId: input.fatherId || null,
        motherId: input.motherId || null,
      },
    });

    return tx.birthRecord.create({
      data: {
        recordNumber: generateRecordNumber("NAI"),
        childId: child.id,
        dateOfBirth: new Date(input.dateOfBirth),
        placeOfBirth: input.placeOfBirth.trim(),
        declarantName: input.declarantName.trim(),
        declarantRelation: input.declarantRelation?.trim(),
        arrondissementId: input.arrondissementId,
        createdById: actor.id,
      },
      include: { child: true },
    });
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "births",
    entityType: "BirthRecord",
    entityId: record.id,
    arrondissementId: record.arrondissementId,
    newValue: { recordNumber: record.recordNumber, child: `${childFirstName} ${childLastName}` },
  });

  await detectDuplicateBirthRegistration(record.child.id, childFirstName, childLastName, new Date(input.dateOfBirth), record.arrondissementId);

  return record;
}

// Enregistrement officiel de l'acte (DECLARED -> REGISTERED). Prealable
// obligatoire a l'emission d'un certificat (voir services/certificates.ts).
export async function validateBirthRecord(actor: CurrentUser, id: string) {
  if (!can(actor, "births", "validate")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.birthRecord.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Declaration introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) {
    throw new ApiError(403, "Dossier hors de votre perimetre.");
  }
  // Separation des taches (module securite, section 5) : la personne qui a
  // enregistre la declaration ne peut pas etre celle qui la valide, meme si
  // son role cumule les deux permissions.
  if (before.createdById && before.createdById === actor.id) {
    throw new ApiError(403, "Separation des taches : vous ne pouvez pas valider une declaration que vous avez vous-meme enregistree.");
  }
  if (before.status !== "DECLARED") throw new ApiError(400, "Ce dossier n'est pas en attente de validation.");

  // Transition atomique — meme raisonnement que marriages.ts:validateMarriage
  // (voir audit concurrence 2026-09-04).
  const result = await prisma.birthRecord.updateMany({
    where: { id, status: "DECLARED" },
    data: { status: "REGISTERED", registeredAt: new Date() },
  });
  if (result.count === 0) {
    throw new ApiError(409, "Ce dossier a deja ete valide par un autre utilisateur.");
  }
  const updated = await prisma.birthRecord.findUniqueOrThrow({ where: { id } });

  await logAudit({
    user: actor,
    action: "VALIDATE",
    module: "births",
    entityType: "BirthRecord",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status },
  });

  return updated;
}

export async function annulBirthRecord(actor: CurrentUser, id: string, reason: string) {
  if (!can(actor, "births", "revoke")) throw new ApiError(403, "Permission insuffisante.");
  if (!reason?.trim()) throw new ApiError(400, "Un motif est requis.");
  const before = await prisma.birthRecord.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Declaration introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) {
    throw new ApiError(403, "Dossier hors de votre perimetre.");
  }

  const updated = await prisma.birthRecord.update({ where: { id }, data: { status: "ANNULLED" } });

  await logAudit({
    user: actor,
    action: "REVOKE",
    module: "births",
    entityType: "BirthRecord",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status, reason },
  });

  return updated;
}
