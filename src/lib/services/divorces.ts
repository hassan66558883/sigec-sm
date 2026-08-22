import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

export async function listDivorces(user: CurrentUser) {
  return prisma.divorce.findMany({
    where: recordScopeWhere(user),
    include: { marriage: { include: { husband: true, wife: true } }, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 100,
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
    },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "divorces",
    entityType: "Divorce",
    entityId: created.id,
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
  if (before.status !== "DECLARED") throw new ApiError(400, "Ce dossier n'est pas en attente de validation.");

  const updated = await prisma.$transaction(async (tx) => {
    const d = await tx.divorce.update({ where: { id }, data: { status: "FINALIZED" } });
    await tx.marriage.update({ where: { id: before.marriageId }, data: { status: "DIVORCED" } });
    await tx.citizen.update({ where: { id: before.marriage.husbandId }, data: { maritalStatus: "DIVORCED" } });
    await tx.citizen.update({ where: { id: before.marriage.wifeId }, data: { maritalStatus: "DIVORCED" } });
    return d;
  });

  await logAudit({
    user: actor,
    action: "VALIDATE",
    module: "divorces",
    entityType: "Divorce",
    entityId: id,
    oldValue: { status: before.status },
    newValue: { status: updated.status },
  });

  return updated;
}
