import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

// Referentiel des activites economiques (section 9) — configurable par
// l'administration, jamais une liste figee dans le code (section 44).
export async function listActivities() {
  return prisma.activiteEconomique.findMany({ orderBy: { name: "asc" } });
}

export async function createActivity(actor: CurrentUser, input: { code: string; name: string; description?: string }) {
  if (!can(actor, "tariffs", "create")) throw new ApiError(403, "Permission insuffisante.");
  const code = input.code?.trim().toUpperCase();
  const name = input.name?.trim();
  if (!code || !name) throw new ApiError(400, "Code et nom requis.");

  const existing = await prisma.activiteEconomique.findUnique({ where: { code } });
  if (existing) throw new ApiError(409, "Une activite avec ce code existe deja.");

  const created = await prisma.activiteEconomique.create({
    data: { code, name, description: input.description?.trim() },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "tariffs",
    entityType: "ActiviteEconomique",
    entityId: created.id,
    newValue: { code: created.code, name: created.name },
  });

  return created;
}

export async function setActivityActive(actor: CurrentUser, id: string, isActive: boolean) {
  if (!can(actor, "tariffs", "edit")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.activiteEconomique.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Activite introuvable.");
  const updated = await prisma.activiteEconomique.update({ where: { id }, data: { isActive } });
  await logAudit({
    user: actor,
    action: "UPDATE",
    module: "tariffs",
    entityType: "ActiviteEconomique",
    entityId: id,
    oldValue: { isActive: before.isActive },
    newValue: { isActive: updated.isActive },
  });
  return updated;
}
