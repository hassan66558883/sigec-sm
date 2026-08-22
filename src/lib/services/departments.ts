import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

// Services / directions centrales de la Mairie Centrale. Purement
// organisationnel (regroupement des utilisateurs CENTRAL), sans lien avec le
// perimetre territorial des arrondissements.
export async function listDepartments() {
  return prisma.department.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createDepartment(
  actor: CurrentUser,
  input: { name: string; code: string; description?: string },
) {
  if (!can(actor, "departments", "create")) throw new ApiError(403, "Permission insuffisante.");
  const name = input.name?.trim();
  const code = input.code?.trim().toUpperCase();
  if (!name || !code) throw new ApiError(400, "Nom et code sont requis.");
  const created = await prisma.department.create({
    data: { name, code, description: input.description?.trim() },
  });
  await logAudit({
    user: actor,
    action: "CREATE",
    module: "departments",
    entityType: "Department",
    entityId: created.id,
    newValue: created,
  });
  return created;
}

export async function setDepartmentActive(actor: CurrentUser, id: string, isActive: boolean) {
  if (!can(actor, "departments", "edit")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.department.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Service central introuvable.");
  const updated = await prisma.department.update({ where: { id }, data: { isActive } });
  await logAudit({
    user: actor,
    action: "UPDATE",
    module: "departments",
    entityType: "Department",
    entityId: id,
    oldValue: { isActive: before.isActive },
    newValue: { isActive: updated.isActive },
  });
  return updated;
}
