import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { validatePasswordStrength } from "@/lib/password-policy";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listUsers(user: CurrentUser) {
  const where = user.hasGlobalScope
    ? {}
    : { arrondissements: { some: { arrondissementId: { in: user.arrondissementIds } } } };
  return prisma.user.findMany({
    where,
    include: {
      roles: { include: { role: true } },
      arrondissements: { include: { arrondissement: true } },
      department: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createUser(
  actor: CurrentUser,
  input: {
    name: string;
    email: string;
    password: string;
    phone?: string | null;
    roleIds: string[];
    organizationLevel: string;
    departmentId?: string | null;
    arrondissementIds: string[];
  },
) {
  if (!can(actor, "users", "create")) throw new ApiError(403, "Permission insuffisante.");
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone?.trim() || null;
  if (!name || !email || !EMAIL_RE.test(email)) throw new ApiError(400, "Nom et email valides requis.");
  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) throw new ApiError(400, passwordError);

  const organizationLevel = input.organizationLevel === "CENTRAL" ? "CENTRAL" : "ARRONDISSEMENT";

  // Seule la Mairie Centrale peut creer des comptes CENTRAL : un compte
  // rattache a un arrondissement ne doit pas pouvoir s'auto-attribuer (ni
  // attribuer a un tiers) une vision globale de la ville.
  if (organizationLevel === "CENTRAL" && !actor.hasGlobalScope) {
    throw new ApiError(403, "Seule la Mairie Centrale peut creer un compte de niveau central.");
  }

  if (organizationLevel === "CENTRAL") {
    if (input.arrondissementIds.length > 0) {
      throw new ApiError(400, "Un compte de niveau central n'est rattache a aucun arrondissement.");
    }
  } else {
    if (input.arrondissementIds.length === 0) {
      throw new ApiError(400, "Un compte de niveau arrondissement doit etre rattache a au moins un arrondissement.");
    }
    if (!actor.hasGlobalScope) {
      const outOfScope = input.arrondissementIds.some((id) => !actor.arrondissementIds.includes(id));
      if (outOfScope) throw new ApiError(403, "Arrondissement hors de votre perimetre.");
    }
  }

  if (input.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!dept || !dept.isActive) throw new ApiError(400, "Service central invalide.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, "Un utilisateur avec cet email existe deja.");

  const hashed = await bcrypt.hash(input.password, 12);
  const created = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      password: hashed,
      mustResetPwd: true,
      organizationLevel,
      departmentId: organizationLevel === "CENTRAL" ? input.departmentId ?? null : null,
      roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
      arrondissements: { create: input.arrondissementIds.map((arrondissementId) => ({ arrondissementId })) },
    },
    include: { roles: { include: { role: true } } },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "users",
    entityType: "User",
    entityId: created.id,
    newValue: { name: created.name, email: created.email, roleIds: input.roleIds, organizationLevel },
  });

  return created;
}

export async function setUserActive(actor: CurrentUser, id: string, isActive: boolean) {
  if (!can(actor, "users", "edit")) throw new ApiError(403, "Permission insuffisante.");
  if (actor.id === id && !isActive) throw new ApiError(400, "Vous ne pouvez pas desactiver votre propre compte.");
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Utilisateur introuvable.");
  const updated = await prisma.user.update({ where: { id }, data: { isActive } });
  await logAudit({
    user: actor,
    action: "UPDATE",
    module: "users",
    entityType: "User",
    entityId: id,
    oldValue: { isActive: before.isActive },
    newValue: { isActive: updated.isActive },
  });
  return updated;
}

// Reinitialisation de mot de passe par un administrateur (module securite,
// section 2/19) : la seule voie de recuperation pour un compte bloque,
// puisqu'aucun service d'envoi d'email n'existe dans ce projet (decision
// explicite de l'utilisateur — pas de flux "mot de passe oublie" par
// courriel). Meme convention que createUser() : l'administrateur saisit
// lui-meme le nouveau mot de passe (jamais genere puis affiche en clair
// dans l'interface), et mustResetPwd force l'utilisateur a le changer a
// sa prochaine connexion.
export async function resetUserPasswordByAdmin(actor: CurrentUser, id: string, newPassword: string) {
  if (!can(actor, "users", "edit")) throw new ApiError(403, "Permission insuffisante.");
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) throw new ApiError(400, passwordError);

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Utilisateur introuvable.");

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id }, data: { password: hashed, mustResetPwd: true } });

  await logAudit({
    user: actor,
    action: "PASSWORD_RESET_BY_ADMIN",
    module: "users",
    entityType: "User",
    entityId: id,
    newValue: { email: before.email },
  });
}
