import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createUser, setUserActive, listUsers } from "../src/lib/services/users";
import { createRole, setRolePermissions, listPermissions } from "../src/lib/services/roles";
import { createDepartment, setDepartmentActive } from "../src/lib/services/departments";
import { createTestCity, createTestArrondissement, createTestUser, testPrisma, uid, closeTestDb } from "./helpers/fixtures";

describe("gestion des utilisateurs — creation de comptes agents", () => {
  let arrA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
  });

  it("seule la Mairie Centrale peut creer un compte de niveau CENTRAL", async () => {
    const scopedAdmin = await createTestUser({ arrondissementIds: [arrA], permissions: ["users:create"] });
    await expect(
      createUser(scopedAdmin, {
        name: "Test Central",
        email: `${uid("central")}@test.local`,
        password: "Password1234",
        roleIds: [],
        organizationLevel: "CENTRAL",
        arrondissementIds: [],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("un compte ARRONDISSEMENT doit etre rattache a au moins un arrondissement", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["users:create"] });
    await expect(
      createUser(admin, {
        name: "Sans arrondissement",
        email: `${uid("noarr")}@test.local`,
        password: "Password1234",
        roleIds: [],
        organizationLevel: "ARRONDISSEMENT",
        arrondissementIds: [],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("un agent d'arrondissement ne peut pas rattacher un nouveau compte a un arrondissement hors de son perimetre", async () => {
    const arrB = (await createTestArrondissement((await createTestCity()).id, 2)).id;
    const scopedAdmin = await createTestUser({ arrondissementIds: [arrA], permissions: ["users:create"] });
    await expect(
      createUser(scopedAdmin, {
        name: "Hors zone",
        email: `${uid("hors")}@test.local`,
        password: "Password1234",
        roleIds: [],
        organizationLevel: "ARRONDISSEMENT",
        arrondissementIds: [arrB],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("un compte est cree avec mustResetPwd=true et un email deja utilise est refuse", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["users:create"] });
    const email = `${uid("nouvel")}@test.local`;
    const created = await createUser(admin, {
      name: "Nouvel Agent",
      email,
      password: "Password1234",
      roleIds: [],
      organizationLevel: "ARRONDISSEMENT",
      arrondissementIds: [arrA],
    });
    expect(created.mustResetPwd).toBe(true);

    await expect(
      createUser(admin, { name: "Doublon", email, password: "Password1234", roleIds: [], organizationLevel: "ARRONDISSEMENT", arrondissementIds: [arrA] }),
    ).rejects.toMatchObject({ status: 409 });

    const listed = await listUsers(admin);
    expect(listed.map((u) => u.id)).toContain(created.id);
  });

  it("un administrateur ne peut pas desactiver son propre compte", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["users:edit"] });
    await expect(setUserActive(admin, admin.id, false)).rejects.toMatchObject({ status: 400 });
  });
});

describe("roles & permissions", () => {
  it("un role systeme ne peut pas etre cree deux fois avec le meme code", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["roles:create"] });
    const code = uid("ROLE");
    await createRole(admin, { code, name: "Role test" });
    await expect(createRole(admin, { code, name: "Role doublon" })).rejects.toMatchObject({ status: 409 });
  });

  it("les permissions du role SUPER_ADMIN ne sont jamais modifiables", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["roles:edit"] });
    const superAdminRole = await testPrisma.role.findUniqueOrThrow({ where: { code: "SUPER_ADMIN" } });
    await expect(setRolePermissions(admin, superAdminRole.id, [])).rejects.toMatchObject({ status: 400 });
  });

  it("assigner des permissions a un role personnalise remplace integralement l'ancien jeu (pas d'ajout cumulatif)", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["roles:create", "roles:edit"] });
    const role = await createRole(admin, { code: uid("ROLE"), name: "Role permissions" });
    const allPermissions = await listPermissions();
    const [permA, permB] = allPermissions;

    await setRolePermissions(admin, role.id, [permA.id]);
    const afterFirst = await testPrisma.rolePermission.findMany({ where: { roleId: role.id } });
    expect(afterFirst).toHaveLength(1);

    const afterSecond = await setRolePermissions(admin, role.id, [permB.id]);
    expect(afterSecond?.permissions).toHaveLength(1);
    expect(afterSecond?.permissions[0].permissionId).toBe(permB.id);
  });
});

describe("services centraux (departments)", () => {
  it("cree un service central, le desactive sans le supprimer", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["departments:create", "departments:edit"] });
    const dept = await createDepartment(admin, { name: uid("Direction"), code: uid("DIR") });
    expect(dept.isActive).toBe(true);

    const deactivated = await setDepartmentActive(admin, dept.id, false);
    expect(deactivated.id).toBe(dept.id);
    expect(deactivated.isActive).toBe(false);

    const stillThere = await testPrisma.department.findUnique({ where: { id: dept.id } });
    expect(stillThere).not.toBeNull();
  });

  it("permission insuffisante refuse la creation d'un service central", async () => {
    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });
    await expect(createDepartment(noPerm, { name: "X", code: uid("X") })).rejects.toMatchObject({ status: 403 });
  });
});

afterAll(async () => {
  await closeTestDb();
});
