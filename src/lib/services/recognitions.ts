import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

export async function listRecognitions(user: CurrentUser) {
  return prisma.recognition.findMany({
    where: recordScopeWhere(user),
    include: { child: true, parent: true, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
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
    },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "recognitions",
    entityType: "Recognition",
    entityId: created.id,
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
  if (before.status !== "DECLARED") throw new ApiError(400, "Ce dossier n'est pas en attente de validation.");

  const updated = await prisma.$transaction(async (tx) => {
    const rec = await tx.recognition.update({ where: { id }, data: { status: "VALIDATED" } });
    const field = before.parentRole === "FATHER" ? { fatherId: before.parentId } : { motherId: before.parentId };
    await tx.citizen.update({ where: { id: before.childId }, data: field });
    return rec;
  });

  await logAudit({
    user: actor,
    action: "VALIDATE",
    module: "recognitions",
    entityType: "Recognition",
    entityId: id,
    oldValue: { status: before.status },
    newValue: { status: updated.status },
  });

  return updated;
}
