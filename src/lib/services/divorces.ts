import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

// Utilisee a la fois par la page de liste /admin/divorces ET par
// src/app/api/divorces/route.ts (GET) — signature/forme de retour (tableau
// simple) volontairement inchangee ici pour ne pas casser cet appelant. La
// pagination reelle de l'ecran de liste vit dans listDivorcesPage()
// ci-dessous, une fonction dediee.
export async function listDivorces(user: CurrentUser) {
  return prisma.divorce.findMany({
    where: recordScopeWhere(user),
    include: { marriage: { include: { husband: true, wife: true } }, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const DEFAULT_PAGE_SIZE = 25;

// Pagination reelle cote base (skip/take + count) pour l'ecran de liste
// /admin/divorces uniquement : avant ce changement, les divorces au-dela
// des 100 premiers (par date de creation) n'etaient jamais accessibles,
// quelle que soit la page cliquee dans le tableau (voir audit performance
// 2026-09-02) — `listDivorces()` ci-dessus plafonnait a `take: 100` sans
// `skip`.
export async function listDivorcesPage(user: CurrentUser, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const where = recordScopeWhere(user);
  const [rows, total] = await Promise.all([
    prisma.divorce.findMany({
      where,
      include: { marriage: { include: { husband: true, wife: true } }, arrondissement: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.divorce.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

// Rapport (section 31) : meme perimetre territorial, plafond plus haut que
// listDivorces() (reservee aux ecrans admin pagines).
export async function listDivorcesForReport(user: CurrentUser) {
  return prisma.divorce.findMany({
    where: recordScopeWhere(user),
    include: { marriage: { include: { husband: true, wife: true } }, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
}

export type DeclareDivorceInput = {
  marriageId: string;
  decisionReference?: string;
  divorceDate: string;
  arrondissementId: string;
};

export async function declareDivorce(actor: CurrentUser, input: DeclareDivorceInput) {
  if (!can(actor, "divorces", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.marriageId || !input.divorceDate) throw new ApiError(400, "Mariage et date requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }

  const marriage = await prisma.marriage.findUnique({ where: { id: input.marriageId } });
  if (!marriage) throw new ApiError(404, "Mariage introuvable.");
  if (marriage.status !== "VALID") throw new ApiError(400, "Ce mariage n'est pas dans un etat permettant un divorce.");

  const created = await prisma.divorce.create({
    data: {
      recordNumber: generateRecordNumber("DIV"),
      marriageId: input.marriageId,
      decisionReference: input.decisionReference?.trim(),
      divorceDate: new Date(input.divorceDate),
      arrondissementId: input.arrondissementId,
      createdById: actor.id,
    },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "divorces",
    entityType: "Divorce",
    entityId: created.id,
    arrondissementId: created.arrondissementId,
    newValue: { recordNumber: created.recordNumber },
  });

  return created;
}

// Finalisation : met a jour le mariage (VALID -> DIVORCED) et la situation
// matrimoniale des deux ex-epoux.
export async function validateDivorce(actor: CurrentUser, id: string) {
  if (!can(actor, "divorces", "validate")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.divorce.findUnique({ where: { id }, include: { marriage: true } });
  if (!before) throw new ApiError(404, "Dossier de divorce introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) {
    throw new ApiError(403, "Dossier hors de votre perimetre.");
  }
  // Separation des taches (module securite, section 5) : la personne qui a
  // enregistre la declaration ne peut pas etre celle qui la valide, meme si
  // son role cumule les deux permissions.
  if (before.createdById && before.createdById === actor.id) {
    throw new ApiError(403, "Separation des taches : vous ne pouvez pas valider un dossier que vous avez vous-meme enregistre.");
  }
  if (before.status !== "DECLARED") throw new ApiError(400, "Ce dossier n'est pas en attente de validation.");

  // Transition atomique — meme raisonnement que marriages.ts:validateMarriage
  // (voir audit concurrence 2026-09-04).
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.divorce.updateMany({ where: { id, status: "DECLARED" }, data: { status: "FINALIZED" } });
    if (result.count === 0) {
      throw new ApiError(409, "Ce dossier a deja ete valide par un autre utilisateur.");
    }
    await tx.marriage.update({ where: { id: before.marriageId }, data: { status: "DIVORCED" } });
    await tx.citizen.update({ where: { id: before.marriage.husbandId }, data: { maritalStatus: "DIVORCED" } });
    await tx.citizen.update({ where: { id: before.marriage.wifeId }, data: { maritalStatus: "DIVORCED" } });
    return tx.divorce.findUniqueOrThrow({ where: { id } });
  });

  await logAudit({
    user: actor,
    action: "VALIDATE",
    module: "divorces",
    entityType: "Divorce",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status },
  });

  return updated;
}
