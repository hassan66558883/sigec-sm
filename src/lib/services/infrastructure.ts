import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

const TYPES = ["ROAD", "LIGHTING", "DRAINAGE", "WASTE", "PUBLIC_SPACE", "OTHER"];
const STATUSES = ["REPORTED", "IN_PROGRESS", "COMPLETED"];

type CitizenAccountWithCitizen = { id: string; citizen: { arrondissementId: string } };

export async function listMyReports(account: CitizenAccountWithCitizen) {
  return prisma.infrastructure.findMany({
    where: { reportedById: account.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function reportIssue(account: CitizenAccountWithCitizen, input: { type: string; description: string; location?: string }) {
  if (!TYPES.includes(input.type)) throw new ApiError(400, "Type invalide.");
  if (!input.description?.trim()) throw new ApiError(400, "Description requise.");
  return prisma.infrastructure.create({
    data: {
      reportNumber: generateRecordNumber("VOI"),
      type: input.type,
      description: input.description.trim(),
      location: input.location?.trim(),
      arrondissementId: account.citizen.arrondissementId,
      reportedById: account.id,
    },
  });
}

export async function listInfrastructureForStaff(user: CurrentUser) {
  if (!can(user, "infrastructure", "view")) throw new ApiError(403, "Permission insuffisante.");
  return prisma.infrastructure.findMany({
    where: recordScopeWhere(user),
    include: { arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function updateInfrastructureStatus(actor: CurrentUser, id: string, status: string) {
  if (!can(actor, "infrastructure", "update")) throw new ApiError(403, "Permission insuffisante.");
  if (!STATUSES.includes(status)) throw new ApiError(400, "Statut invalide.");
  const before = await prisma.infrastructure.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Signalement introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) throw new ApiError(403, "Signalement hors de votre perimetre.");

  const updated = await prisma.infrastructure.update({
    where: { id },
    data: { status, resolvedAt: status === "COMPLETED" ? new Date() : before.resolvedAt },
  });
  await logAudit({ user: actor, action: "UPDATE", module: "infrastructure", entityType: "Infrastructure", entityId: id, oldValue: { status: before.status }, newValue: { status } });
  return updated;
}
