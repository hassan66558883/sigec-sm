import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

// Utilisee a la fois par la page de liste /admin/recognitions ET par
// src/app/api/recognitions/route.ts (GET) — signature/forme de retour
// (tableau simple) volontairement inchangee ici pour ne pas casser cet
// appelant. La pagination reelle de l'ecran de liste vit dans
// listRecognitionsPage() ci-dessous, une fonction dediee.
export async function listRecognitions(user: CurrentUser) {
  return prisma.recognition.findMany({
    where: recordScopeWhere(user),
    include: { child: true, parent: true, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const DEFAULT_PAGE_SIZE = 25;

// Pagination reelle cote base (skip/take + count) pour l'ecran de liste
// /admin/recognitions uniquement : avant ce changement, les reconnaissances
// au-dela des 100 premieres (par date de creation) n'etaient jamais
// accessibles, quelle que soit la page cliquee dans le tableau (voir audit
// performance 2026-09-02) — `listRecognitions()` ci-dessus plafonnait a
// `take: 100` sans `skip`.
export async function listRecognitionsPage(user: CurrentUser, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const where = recordScopeWhere(user);
  const [rows, total] = await Promise.all([
    prisma.recognition.findMany({
      where,
      include: { child: true, parent: true, arrondissement: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.recognition.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

export type DeclareRecognitionInput = {
  childId: string;
  parentId: string;
  parentRole: string; // FATHER | MOTHER
  arrondissementId: string;
};

export async function declareRecognition(actor: CurrentUser, input: DeclareRecognitionInput) {
  if (!can(actor, "recognitions", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.childId || !input.parentId) throw new ApiError(400, "Enfant et parent requis.");
  if (input.parentRole !== "FATHER" && input.parentRole !== "MOTHER") {
    throw new ApiError(400, "Role du parent invalide.");
  }
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }

  const existing = await prisma.recognition.findUnique({ where: { childId: input.childId } });
  if (existing) throw new ApiError(409, "Cet enfant a deja une reconnaissance enregistree.");

  const created = await prisma.recognition.create({
    data: {
      recordNumber: generateRecordNumber("REC"),
      childId: input.childId,
      parentId: input.parentId,
      parentRole: input.parentRole,
      arrondissementId: input.arrondissementId,
      createdById: actor.id,
    },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "recognitions",
    entityType: "Recognition",
    entityId: created.id,
    arrondissementId: created.arrondissementId,
    newValue: { recordNumber: created.recordNumber },
  });

  return created;
}

export async function validateRecognition(actor: CurrentUser, id: string) {
  if (!can(actor, "recognitions", "validate")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.recognition.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Reconnaissance introuvable.");
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
    const result = await tx.recognition.updateMany({ where: { id, status: "DECLARED" }, data: { status: "VALIDATED" } });
    if (result.count === 0) {
      throw new ApiError(409, "Ce dossier a deja ete valide par un autre utilisateur.");
    }
    const field = before.parentRole === "FATHER" ? { fatherId: before.parentId } : { motherId: before.parentId };
    await tx.citizen.update({ where: { id: before.childId }, data: field });
    return tx.recognition.findUniqueOrThrow({ where: { id } });
  });

  await logAudit({
    user: actor,
    action: "VALIDATE",
    module: "recognitions",
    entityType: "Recognition",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status },
  });

  return updated;
}
