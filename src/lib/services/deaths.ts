import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";
import { encryptField, decryptField } from "@/lib/encryption";
import { periodBounds } from "@/lib/date-buckets";
import { detectDuplicateDeathRegistration } from "@/lib/services/fraud";

// KPI d'en-tete (tableau de bord Deces, Phase 2).
export async function getDeathsPeriodStats(user: CurrentUser) {
  const scope = recordScopeWhere(user);
  const { startOfDay, startOfWeek, startOfMonth, startOfYear } = periodBounds();
  const [today, week, month, year] = await Promise.all([
    prisma.deathRecord.count({ where: { ...scope, createdAt: { gte: startOfDay } } }),
    prisma.deathRecord.count({ where: { ...scope, createdAt: { gte: startOfWeek } } }),
    prisma.deathRecord.count({ where: { ...scope, createdAt: { gte: startOfMonth } } }),
    prisma.deathRecord.count({ where: { ...scope, createdAt: { gte: startOfYear } } }),
  ]);
  return { today, week, month, year };
}

// Utilisee a la fois par la page de liste /admin/deaths ET par
// src/app/api/deaths/route.ts (GET) — signature/forme de retour (tableau
// simple) volontairement inchangee ici pour ne pas casser cet appelant. La
// pagination reelle de l'ecran de liste vit dans listDeathRecordsPage()
// ci-dessous, une fonction dediee.
export async function listDeathRecords(user: CurrentUser, search?: string) {
  const records = await prisma.deathRecord.findMany({
    where: {
      ...recordScopeWhere(user),
      ...(search ? { recordNumber: { contains: search, mode: "insensitive" } } : {}),
    },
    include: { deceased: true, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  // cause est chiffree en base (section 32) ; dechiffree ici pour que tout
  // appelant (page admin, futur export...) recoive du texte en clair sans
  // avoir a connaitre le detail du chiffrement.
  return records.map((r) => ({ ...r, cause: decryptField(r.cause) }));
}

const DEFAULT_PAGE_SIZE = 25;

// Pagination reelle cote base (skip/take + count) pour l'ecran de liste
// /admin/deaths uniquement : avant ce changement, les actes au-dela des 100
// premiers (par date de creation) n'etaient jamais accessibles, quelle que
// soit la page cliquee dans le tableau (voir audit performance 2026-09-02)
// — `listDeathRecords()` ci-dessus plafonnait a `take: 100` sans `skip`.
export async function listDeathRecordsPage(user: CurrentUser, search?: string, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const where = {
    ...recordScopeWhere(user),
    ...(search ? { recordNumber: { contains: search, mode: "insensitive" as const } } : {}),
  };
  const [records, total] = await Promise.all([
    prisma.deathRecord.findMany({
      where,
      include: { deceased: true, arrondissement: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.deathRecord.count({ where }),
  ]);
  return { rows: records.map((r) => ({ ...r, cause: decryptField(r.cause) })), total, page, pageSize };
}

// Rapport (section 31) : meme perimetre territorial + dechiffrement de
// `cause`, plafond plus haut que listDeathRecords() (ecrans admin pagines).
export async function listDeathRecordsForReport(user: CurrentUser) {
  const records = await prisma.deathRecord.findMany({
    where: recordScopeWhere(user),
    include: { deceased: true, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  return records.map((r) => ({ ...r, cause: decryptField(r.cause) }));
}

export type DeclareDeathInput = {
  deceasedId: string;
  dateOfDeath: string;
  placeOfDeath: string;
  cause?: string;
  declarantName: string;
  declarantRelation?: string;
  arrondissementId: string;
};

// cause est optionnel et ne doit etre rempli que si legalement requis
// (regle 39 du cahier des charges — aucune obligation presumee ici).
export async function declareDeath(actor: CurrentUser, input: DeclareDeathInput) {
  if (!can(actor, "deaths", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.deceasedId || !input.dateOfDeath || !input.placeOfDeath?.trim()) {
    throw new ApiError(400, "Personne decedee, date et lieu requis.");
  }
  if (!input.declarantName?.trim()) throw new ApiError(400, "Nom du declarant requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }

  const existing = await prisma.deathRecord.findUnique({ where: { deceasedId: input.deceasedId } });
  if (existing) throw new ApiError(409, "Un acte de deces existe deja pour cette personne.");

  const deceased = await prisma.citizen.findUnique({ where: { id: input.deceasedId } });
  if (!deceased) throw new ApiError(404, "Personne decedee introuvable.");

  const created = await prisma.deathRecord.create({
    data: {
      recordNumber: generateRecordNumber("DEC"),
      deceasedId: input.deceasedId,
      dateOfDeath: new Date(input.dateOfDeath),
      placeOfDeath: input.placeOfDeath.trim(),
      cause: encryptField(input.cause?.trim()),
      declarantName: input.declarantName.trim(),
      declarantRelation: input.declarantRelation?.trim(),
      arrondissementId: input.arrondissementId,
      createdById: actor.id,
    },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "deaths",
    entityType: "DeathRecord",
    entityId: created.id,
    arrondissementId: created.arrondissementId,
    newValue: { recordNumber: created.recordNumber },
  });

  await detectDuplicateDeathRegistration(deceased.id, deceased.firstName, deceased.lastName, deceased.dateOfBirth, created.arrondissementId);

  return created;
}

// Mise a jour du fichier de population (section "deces").
export async function validateDeathRecord(actor: CurrentUser, id: string) {
  if (!can(actor, "deaths", "validate")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.deathRecord.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Declaration introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) {
    throw new ApiError(403, "Dossier hors de votre perimetre.");
  }
  if (before.createdById && before.createdById === actor.id) {
    throw new ApiError(403, "Separation des taches : vous ne pouvez pas valider une declaration que vous avez vous-meme enregistree.");
  }
  if (before.status !== "DECLARED") throw new ApiError(400, "Ce dossier n'est pas en attente de validation.");

  // Transition atomique — meme raisonnement que marriages.ts:validateMarriage
  // (voir audit concurrence 2026-09-04).
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.deathRecord.updateMany({ where: { id, status: "DECLARED" }, data: { status: "REGISTERED" } });
    if (result.count === 0) {
      throw new ApiError(409, "Ce dossier a deja ete valide par un autre utilisateur.");
    }
    await tx.citizen.update({ where: { id: before.deceasedId }, data: { isDeceased: true } });
    return tx.deathRecord.findUniqueOrThrow({ where: { id } });
  });

  await logAudit({
    user: actor,
    action: "VALIDATE",
    module: "deaths",
    entityType: "DeathRecord",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status },
  });

  return updated;
}
