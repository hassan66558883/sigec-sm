import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";
import { periodBounds } from "@/lib/date-buckets";
import { detectDuplicateMarriageRegistration } from "@/lib/services/fraud";

// KPI d'en-tete (tableau de bord Mariages, Phase 2).
export async function getMarriagesPeriodStats(user: CurrentUser) {
  const scope = recordScopeWhere(user);
  const { startOfDay, startOfWeek, startOfMonth, startOfYear } = periodBounds();
  const [today, week, month, year] = await Promise.all([
    prisma.marriage.count({ where: { ...scope, createdAt: { gte: startOfDay } } }),
    prisma.marriage.count({ where: { ...scope, createdAt: { gte: startOfWeek } } }),
    prisma.marriage.count({ where: { ...scope, createdAt: { gte: startOfMonth } } }),
    prisma.marriage.count({ where: { ...scope, createdAt: { gte: startOfYear } } }),
  ]);
  return { today, week, month, year };
}

// Utilisee a la fois par la page de liste /admin/marriages ET par
// src/app/api/marriages/route.ts (GET) — signature/forme de retour (tableau
// simple) volontairement inchangee ici pour ne pas casser cet appelant. La
// pagination reelle de l'ecran de liste vit dans listMarriagesPage()
// ci-dessous, une fonction dediee.
export async function listMarriages(user: CurrentUser, search?: string) {
  return prisma.marriage.findMany({
    where: {
      ...recordScopeWhere(user),
      ...(search ? { recordNumber: { contains: search, mode: "insensitive" } } : {}),
    },
    include: { husband: true, wife: true, regime: true, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const DEFAULT_PAGE_SIZE = 25;

// Pagination reelle cote base (skip/take + count) pour l'ecran de liste
// /admin/marriages uniquement : avant ce changement, les mariages au-dela
// des 100 premiers (par date de creation) n'etaient jamais accessibles,
// quelle que soit la page cliquee dans le tableau (voir audit performance
// 2026-09-02) — `listMarriages()` ci-dessus plafonnait a `take: 100` sans
// `skip`.
export async function listMarriagesPage(user: CurrentUser, search?: string, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const where = {
    ...recordScopeWhere(user),
    ...(search ? { recordNumber: { contains: search, mode: "insensitive" as const } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.marriage.findMany({
      where,
      include: { husband: true, wife: true, regime: true, arrondissement: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.marriage.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

// Rapport (section 31) : meme perimetre territorial, plafond plus haut que
// listMarriages() (reservee aux ecrans admin pagines).
export async function listMarriagesForReport(user: CurrentUser) {
  return prisma.marriage.findMany({
    where: recordScopeWhere(user),
    include: { husband: true, wife: true, regime: true, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
}

export async function listMarriageRegimes() {
  return prisma.marriageRegime.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export type DeclareMarriageInput = {
  husbandId: string;
  wifeId: string;
  marriageDate: string;
  marriagePlace: string;
  regimeId?: string | null;
  arrondissementId: string;
  witnesses?: { name: string; role?: string }[];
};

export async function declareMarriage(actor: CurrentUser, input: DeclareMarriageInput) {
  if (!can(actor, "marriages", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.husbandId || !input.wifeId) throw new ApiError(400, "Les deux epoux sont requis.");
  if (input.husbandId === input.wifeId) throw new ApiError(400, "Les epoux doivent etre deux personnes distinctes.");
  if (!input.marriageDate || !input.marriagePlace?.trim()) {
    throw new ApiError(400, "Date et lieu du mariage requis.");
  }
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }

  const created = await prisma.marriage.create({
    data: {
      recordNumber: generateRecordNumber("MAR"),
      husbandId: input.husbandId,
      wifeId: input.wifeId,
      marriageDate: new Date(input.marriageDate),
      marriagePlace: input.marriagePlace.trim(),
      regimeId: input.regimeId || null,
      arrondissementId: input.arrondissementId,
      createdById: actor.id,
      witnesses: {
        create: (input.witnesses ?? [])
          .filter((w) => w.name?.trim())
          .map((w) => ({ name: w.name.trim(), role: w.role?.trim() })),
      },
    },
    include: { witnesses: true },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "marriages",
    entityType: "Marriage",
    entityId: created.id,
    arrondissementId: created.arrondissementId,
    newValue: { recordNumber: created.recordNumber },
  });

  await detectDuplicateMarriageRegistration(created.id, created.husbandId, created.wifeId, created.arrondissementId);

  return created;
}

// Enregistrement officiel : DECLARED-equivalent -> VALID, met a jour la
// situation matrimoniale des deux epoux (section "mise a jour de la
// situation matrimoniale").
export async function validateMarriage(actor: CurrentUser, id: string) {
  if (!can(actor, "marriages", "validate")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.marriage.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Dossier de mariage introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) {
    throw new ApiError(403, "Dossier hors de votre perimetre.");
  }
  if (before.createdById && before.createdById === actor.id) {
    throw new ApiError(403, "Separation des taches : vous ne pouvez pas valider un dossier que vous avez vous-meme enregistre.");
  }
  if (before.status !== "DECLARED") throw new ApiError(400, "Ce dossier n'est pas en attente de validation.");

  // Transition atomique (voir audit concurrence 2026-09-04) : le controle de
  // statut ci-dessus et l'ecriture ne formaient pas une seule operation
  // atomique — deux clics quasi simultanes sur "Valider" pouvaient tous les
  // deux passer le controle avant que le premier n'ecrive, produisant une
  // double validation (double entree d'audit, double ecriture inutile sur
  // les deux citoyens). `updateMany` avec `status: "DECLARED"` dans le
  // `where` fait du controle+ecriture une seule requete ; `count === 0`
  // signifie qu'un autre utilisateur a deja transitionne ce dossier entre
  // le chargement et cette tentative.
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.marriage.updateMany({ where: { id, status: "DECLARED" }, data: { status: "VALID" } });
    if (result.count === 0) {
      throw new ApiError(409, "Ce dossier a deja ete valide par un autre utilisateur.");
    }
    await tx.citizen.update({ where: { id: before.husbandId }, data: { maritalStatus: "MARRIED" } });
    await tx.citizen.update({ where: { id: before.wifeId }, data: { maritalStatus: "MARRIED" } });
    return tx.marriage.findUniqueOrThrow({ where: { id } });
  });

  await logAudit({
    user: actor,
    action: "VALIDATE",
    module: "marriages",
    entityType: "Marriage",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status },
  });

  return updated;
}
