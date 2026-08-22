import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, canAccessArrondissement, arrondissementScopeWhere } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function listArrondissements(user: CurrentUser) {
  return prisma.arrondissement.findMany({
    where: arrondissementScopeWhere(user),
    include: { city: true, _count: { select: { quartiers: true } } },
    orderBy: { number: "asc" },
  });
}

export async function createArrondissement(
  user: CurrentUser,
  input: { cityId: string; number: number; name: string; code: string },
) {
  if (!can(user, "territorial", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.name?.trim() || !input.code?.trim() || !input.cityId) {
    throw new ApiError(400, "Nom, code et ville sont requis.");
  }
  if (!Number.isInteger(input.number) || input.number < 1) {
    throw new ApiError(400, "Numero d'arrondissement invalide.");
  }
  const created = await prisma.arrondissement.create({
    data: {
      cityId: input.cityId,
      number: input.number,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
    },
  });
  await logAudit({
    user,
    action: "CREATE",
    module: "territorial",
    entityType: "Arrondissement",
    entityId: created.id,
    newValue: created,
  });
  return created;
}

export async function setArrondissementActive(user: CurrentUser, id: string, isActive: boolean) {
  if (!can(user, "territorial", "edit")) throw new ApiError(403, "Permission insuffisante.");
  if (!canAccessArrondissement(user, id)) throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  const before = await prisma.arrondissement.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Arrondissement introuvable.");
  const updated = await prisma.arrondissement.update({ where: { id }, data: { isActive } });
  await logAudit({
    user,
    action: "UPDATE",
    module: "territorial",
    entityType: "Arrondissement",
    entityId: id,
    oldValue: { isActive: before.isActive },
    newValue: { isActive: updated.isActive },
  });
  return updated;
}

export async function listQuartiers(user: CurrentUser, arrondissementId: string) {
  if (!canAccessArrondissement(user, arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }
  return prisma.quartier.findMany({
    where: { arrondissementId },
    include: { _count: { select: { sectors: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createQuartier(
  user: CurrentUser,
  input: { arrondissementId: string; name: string; code: string },
) {
  if (!can(user, "territorial", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!canAccessArrondissement(user, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }
  if (!input.name?.trim() || !input.code?.trim()) {
    throw new ApiError(400, "Nom et code sont requis.");
  }
  const created = await prisma.quartier.create({
    data: {
      arrondissementId: input.arrondissementId,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
    },
  });
  await logAudit({
    user,
    action: "CREATE",
    module: "territorial",
    entityType: "Quartier",
    entityId: created.id,
    newValue: created,
  });
  return created;
}

export async function setQuartierActive(user: CurrentUser, id: string, isActive: boolean) {
  if (!can(user, "territorial", "edit")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.quartier.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Quartier introuvable.");
  if (!canAccessArrondissement(user, before.arrondissementId)) {
    throw new ApiError(403, "Quartier hors de votre perimetre.");
  }
  const updated = await prisma.quartier.update({ where: { id }, data: { isActive } });
  await logAudit({
    user,
    action: "UPDATE",
    module: "territorial",
    entityType: "Quartier",
    entityId: id,
    oldValue: { isActive: before.isActive },
    newValue: { isActive: updated.isActive },
  });
  return updated;
}

export async function listSectors(user: CurrentUser, quartierId: string) {
  const quartier = await prisma.quartier.findUnique({ where: { id: quartierId } });
  if (!quartier) throw new ApiError(404, "Quartier introuvable.");
  if (!canAccessArrondissement(user, quartier.arrondissementId)) {
    throw new ApiError(403, "Quartier hors de votre perimetre.");
  }
  return prisma.sector.findMany({ where: { quartierId }, orderBy: { name: "asc" } });
}

export async function createSector(user: CurrentUser, input: { quartierId: string; name: string; code: string }) {
  if (!can(user, "territorial", "create")) throw new ApiError(403, "Permission insuffisante.");
  const quartier = await prisma.quartier.findUnique({ where: { id: input.quartierId } });
  if (!quartier) throw new ApiError(404, "Quartier introuvable.");
  if (!canAccessArrondissement(user, quartier.arrondissementId)) {
    throw new ApiError(403, "Quartier hors de votre perimetre.");
  }
  if (!input.name?.trim() || !input.code?.trim()) {
    throw new ApiError(400, "Nom et code sont requis.");
  }
  const created = await prisma.sector.create({
    data: {
      quartierId: input.quartierId,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
    },
  });
  await logAudit({
    user,
    action: "CREATE",
    module: "territorial",
    entityType: "Sector",
    entityId: created.id,
    newValue: created,
  });
  return created;
}
