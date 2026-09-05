import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { validatePasswordStrength } from "../src/lib/password-policy";
import { recordLoginAttempt, isAccountLocked } from "../src/lib/services/login-security";
import { createUser, resetUserPasswordByAdmin } from "../src/lib/services/users";
import { createTestCity, createTestArrondissement, createTestUser, testPrisma, uid, closeTestDb } from "./helpers/fixtures";

// Module securite (master instruction, sections 2/6/25) — politique de mot
// de passe, verrouillage de compte par email, reinitialisation par un
// administrateur, et immutabilite du journal d'audit AU NIVEAU BASE DE
// DONNEES (pas seulement une convention applicative).
describe("politique de mot de passe", () => {
  it("rejette un mot de passe trop court, sans majuscule, sans minuscule, ou sans chiffre", () => {
    expect(validatePasswordStrength("court1A")).toMatch(/10 caracteres/);
    expect(validatePasswordStrength("abcdefghij1")).toMatch(/majuscule/);
    expect(validatePasswordStrength("ABCDEFGHIJ1")).toMatch(/minuscule/);
    expect(validatePasswordStrength("Abcdefghij")).toMatch(/chiffre/);
  });

  it("accepte un mot de passe conforme", () => {
    expect(validatePasswordStrength("Abcdefghij1")).toBeNull();
  });
});

describe("verrouillage de compte apres echecs de connexion repetes", () => {
  it("verrouille apres le seuil d'echecs configure, se deverrouille avec un succes", async () => {
    const email = `${uid("lockout")}@test.local`;

    expect(await isAccountLocked(email)).toBe(false);

    // Seuil par defaut : 5 echecs (voir DEFAULT_THRESHOLDS.loginLockoutMaxAttempts dans fraud.ts).
    for (let i = 0; i < 4; i++) {
      await recordLoginAttempt(email, "127.0.0.1", "test-agent", false);
    }
    expect(await isAccountLocked(email)).toBe(false); // 4 echecs, sous le seuil

    await recordLoginAttempt(email, "127.0.0.1", "test-agent", false);
    expect(await isAccountLocked(email)).toBe(true); // 5e echec, verrouille

    const alert = await testPrisma.fraudAlert.findFirst({ where: { type: "EXCESSIVE_LOGIN_FAILURES", description: { contains: email } } });
    expect(alert).not.toBeNull();
    expect(alert?.severity).toBe("HIGH");

    // Un compte deja verrouille ne fait jamais avancer son propre compteur
    // (recordLoginAttempt n'est jamais appelee pendant un verrouillage actif,
    // voir la route de login) — recentFailures reste bloque pile au seuil.
    // Sans la deduplication par alerte-existante-dans-la-fenetre (pas juste
    // "=== seuil"), chaque nouvel appel a isAccountLocked() re-declencherait
    // une alerte : verifie qu'un seul incident est journalise, pas un par
    // tentative pendant le verrouillage.
    expect(await isAccountLocked(email)).toBe(true);
    expect(await isAccountLocked(email)).toBe(true);
    const alertCount = await testPrisma.fraudAlert.count({ where: { type: "EXCESSIVE_LOGIN_FAILURES", description: { contains: email } } });
    expect(alertCount).toBe(1);
  });

  it("une connexion reussie remet le compteur d'echecs a zero (4 echecs + succes + 4 echecs ne verrouille pas)", async () => {
    const email = `${uid("lockout-reset")}@test.local`;
    for (let i = 0; i < 4; i++) await recordLoginAttempt(email, "127.0.0.1", "test-agent", false);
    expect(await isAccountLocked(email)).toBe(false);

    await recordLoginAttempt(email, "127.0.0.1", "test-agent", true);

    // Sans la remise a zero, ces 4 nouveaux echecs s'ajouteraient aux 4
    // precedents et depasseraient le seuil de 5 des le 1er nouvel echec.
    for (let i = 0; i < 4; i++) await recordLoginAttempt(email, "127.0.0.1", "test-agent", false);
    expect(await isAccountLocked(email)).toBe(false);

    await recordLoginAttempt(email, "127.0.0.1", "test-agent", false);
    expect(await isAccountLocked(email)).toBe(true);
  });

  it("le verrouillage est independant de l'IP d'origine (protege contre une attaque distribuee sur un seul compte)", async () => {
    const email = `${uid("lockout-distributed")}@test.local`;
    const ips = ["10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.4", "10.0.0.5"];
    for (const ip of ips) {
      await recordLoginAttempt(email, ip, "test-agent", false);
    }
    expect(await isAccountLocked(email)).toBe(true);
  });
});

describe("reinitialisation de mot de passe par un administrateur", () => {
  let arrA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
  });

  it("reinitialise le mot de passe, force mustResetPwd, journalise l'action ; refuse sans permission ou avec un mot de passe faible", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["users:create", "users:edit"] });
    const target = await createUser(admin, {
      name: "Cible Test",
      email: `${uid("cible")}@test.local`,
      password: "Abcdefghij1",
      roleIds: [],
      organizationLevel: "ARRONDISSEMENT",
      arrondissementIds: [arrA],
    });

    await resetUserPasswordByAdmin(admin, target.id, "Nouveaumdp1");
    const updated = await testPrisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(updated.mustResetPwd).toBe(true);
    expect(updated.password).not.toBe(target.password); // rehache, jamais le meme hash

    const audit = await testPrisma.auditLog.findFirst({ where: { action: "PASSWORD_RESET_BY_ADMIN", entityId: target.id } });
    expect(audit).not.toBeNull();

    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });
    await expect(resetUserPasswordByAdmin(noPerm, target.id, "Abcdefghij1")).rejects.toMatchObject({ status: 403 });
    await expect(resetUserPasswordByAdmin(admin, target.id, "faible")).rejects.toMatchObject({ status: 400 });
  });
});

describe("immutabilite du journal d'audit (niveau base de donnees)", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("un trigger Postgres refuse categoriquement toute tentative d'UPDATE ou DELETE sur AuditLog", async () => {
    const created = await testPrisma.auditLog.create({
      data: { userName: "Test Immutabilite", action: "TEST", module: "test", result: "SUCCESS" },
    });

    await expect(
      testPrisma.$executeRawUnsafe(`UPDATE "AuditLog" SET action = 'HACKED' WHERE id = '${created.id}'`),
    ).rejects.toThrow(/immuable/);

    await expect(
      testPrisma.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE id = '${created.id}'`),
    ).rejects.toThrow(/immuable/);

    // La ligne existe toujours, inchangee — la tentative de modification a bien echoue.
    const stillThere = await testPrisma.auditLog.findUnique({ where: { id: created.id } });
    expect(stillThere?.action).toBe("TEST");

    // Nettoyage du test : desactive le trigger le temps de retirer CETTE
    // ligne de test (privilege du proprietaire de table, pas une operation
    // normale de l'application) puis le reactive immediatement.
    await testPrisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DISABLE TRIGGER audit_log_immutable`);
    await testPrisma.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE id = '${created.id}'`);
    await testPrisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ENABLE TRIGGER audit_log_immutable`);
  });
});
