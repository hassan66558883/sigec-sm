import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function listRoles() {
  return prisma.role.findMany({
    include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listPermissions() {
  return prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] });
}

export async function createRole(actor: CurrentUser, input: { code: string; name: string; description?: string }) {
  if (!can(actor, "roles", "create")) throw new ApiError(403, "Permission insuffisante.");
  const code = input.code?.trim().toUpperCase().replace(/\s+/g, "_");
  const name = input.name?.trim();
  if (!code || !name) throw new ApiError(400, "Code et nom sont requis.");
  const existing = await prisma.role.findUnique({ where: { code } });
  if (existing) throw new ApiError(409, "Un role avec ce code existe deja.");
  const created = await prisma.role.create({
    data: { code, name, description: input.description?.trim(), isSystem: false },
  });
  await logAudit({ user: actor, action: "CREATE", module: "roles", entityType: "Role", entityId: created.id, newValue: created });
  return created;
}

export async function setRolePermissions(actor: CurrentUser, roleId: string, permissionIds: string[]) {
  if (!can(actor, "roles", "edit")) throw new ApiError(403, "Permission insuffisante.");
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new ApiError(404, "Role introuvable.");
  if (role.isSystem && role.code === "SUPER_ADMIN") {
    throw new ApiError(400, "Les permissions du role SUPER_ADMIN ne sont pas modifiables.");
  }
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId, permissionId })) }),
  ]);
  await logAudit({
    user: actor,
    action: "UPDATE",
    module: "roles",
    entityType: "Role",
    entityId: roleId,
    newValue: { permissionIds },
  });
  return prisma.role.findUnique({ where: { id: roleId }, include: { permissions: { include: { permission: true } } } });
}
