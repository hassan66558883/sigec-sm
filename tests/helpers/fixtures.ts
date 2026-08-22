import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import type { CurrentUser, OrganizationLevel } from "../../src/lib/auth";

// Client Prisma dedie aux tests, isole du singleton global de l'application
// (src/lib/db.ts) pour ne jamais partager de connexion avec un serveur dev
// eventuellement lance en parallele.
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
export const testPrisma = new PrismaClient({ adapter });

export function uid(prefix: string) {
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}

export async function closeTestDb() {
  await testPrisma.$disconnect();
  await pool.end();
}

export async function createTestCity() {
  return testPrisma.city.create({ data: { name: uid("Ville"), code: uid("V") } });
}

export async function createTestArrondissement(cityId: string, number: number) {
  return testPrisma.arrondissement.create({
    data: { cityId, number, name: uid("Arrondissement"), code: uid("ARR") },
  });
}

// Cree un User reel (necessaire : AuditLog.userId est une FK reelle vers
// User, donc tout acteur qui declenche logAudit() doit exister en base)
// et renvoie un objet CurrentUser pret a etre passe directement aux
// fonctions de service, sans passer par le flux de login HTTP.
export async function createTestUser(options: {
  organizationLevel?: OrganizationLevel;
  arrondissementIds?: string[];
  permissions?: string[];
}): Promise<CurrentUser> {
  const email = `${uid("user")}@test.local`;
  const hashed = await bcrypt.hash("Test1234!", 4); // cout reduit : vitesse des tests, jamais en prod
  const user = await testPrisma.user.create({
    data: {
      name: uid("Agent Test"),
      email,
      password: hashed,
      organizationLevel: options.organizationLevel ?? "ARRONDISSEMENT",
    },
  });

  const organizationLevel = (options.organizationLevel ?? "ARRONDISSEMENT") as OrganizationLevel;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: true,
    mustResetPwd: false,
    roles: [],
    permissions: new Set(options.permissions ?? []),
    organizationLevel,
    hasGlobalScope: organizationLevel === "CENTRAL",
    departmentId: null,
    arrondissementIds: options.arrondissementIds ?? [],
    quartierIds: [],
  };
}

export async function createTestCitizen(arrondissementId: string, overrides: Partial<{ firstName: string; lastName: string; sex: string }> = {}) {
  return testPrisma.citizen.create({
    data: {
      uniqueNumber: uid("CIT"),
      firstName: overrides.firstName ?? "Prenom",
      lastName: overrides.lastName ?? uid("Nom"),
      sex: overrides.sex ?? "M",
      arrondissementId,
    },
  });
}

// Jeu de permissions "administrateur central" complet pour les modules
// couverts par les tests — evite de lister chaque permission a chaque test.
export const ALL_TEST_PERMISSIONS = [
  "citizens:view", "citizens:create", "citizens:edit",
  "households:view", "households:create",
  "births:view", "births:create", "births:validate", "births:revoke",
  "recognitions:view", "recognitions:create", "recognitions:validate",
  "marriages:view", "marriages:create", "marriages:validate",
  "divorces:view", "divorces:create", "divorces:validate",
  "deaths:view", "deaths:create", "deaths:validate",
  "certificates:view", "certificates:create", "certificates:print", "certificates:revoke",
  "territorial:view", "territorial:create", "territorial:edit",
  "users:view", "users:create", "users:edit",
  "audit:view",
  "payments:view", "payments:create", "payments:export",
  "businesses:view", "businesses:create",
];
