import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

export async function listMarriages(user: CurrentUser) {
  return prisma.marriage.findMany({
    where: recordScopeWhere(user),
    include: { husband: true, wife: true, regime: true, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 100,
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
  if (before.status !== "DECLARED") throw new ApiError(400, "Ce dossier n'est pas en attente de validation.");

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.marriage.update({ where: { id }, data: { status: "VALID" } });
    await tx.citizen.update({ where: { id: before.husbandId }, data: { maritalStatus: "MARRIED" } });
    await tx.citizen.update({ where: { id: before.wifeId }, data: { maritalStatus: "MARRIED" } });
    return m;
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
