import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generate } from "otplib";
import { validatePasswordStrength } from "../src/lib/password-policy";
import { recordLoginAttempt, isAccountLocked } from "../src/lib/services/login-security";
import { createUser, resetUserPasswordByAdmin } from "../src/lib/services/users";
import { beginMfaSetup, confirmMfaSetup, verifyMfaCode, disableMfaSelf, disableMfaByAdmin } from "../src/lib/services/mfa";
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

describe("authentification a deux facteurs (MFA / TOTP)", () => {
  it("configuration complete : n'active qu'apres un code reel verifie, jamais avant", async () => {
    const agent = await createTestUser({});

    const { secret, qrDataUrl } = await beginMfaSetup(agent);
    expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);

    // Configuration commencee mais pas confirmee : le compte reste non
    // protege, un mauvais code ne peut jamais activer le MFA par erreur.
    await expect(confirmMfaSetup(agent, "000000")).rejects.toMatchObject({ status: 400 });
    const stillOff = await testPrisma.user.findUniqueOrThrow({ where: { id: agent.id } });
    expect(stillOff.mfaEnabled).toBe(false);

    const validCode = await generate({ secret });
    const backupCodes = await confirmMfaSetup(agent, validCode);
    expect(backupCodes).toHaveLength(10);

    const enabled = await testPrisma.user.findUniqueOrThrow({ where: { id: agent.id } });
    expect(enabled.mfaEnabled).toBe(true);
    expect(enabled.mfaSecret).not.toBe(secret); // chiffre au repos, jamais stocke en clair
    expect(enabled.mfaBackupCodes).toHaveLength(10);

    // Deja active : une 2e configuration est refusee tant que l'existante
    // n'a pas ete retiree.
    await expect(beginMfaSetup(agent)).rejects.toMatchObject({ status: 400 });

    // La 2e etape de connexion (verifyMfaCode) accepte le meme secret.
    const loginCode = await generate({ secret });
    expect(await verifyMfaCode(agent.id, loginCode)).toBe(true);
    expect(await verifyMfaCode(agent.id, "000000")).toBe(false);
  });

  it("un code de secours fonctionne une seule fois puis est consomme", async () => {
    const agent = await createTestUser({});
    const { secret } = await beginMfaSetup(agent);
    const backupCodes = await confirmMfaSetup(agent, await generate({ secret }));

    const usedCode = backupCodes[0];
    expect(await verifyMfaCode(agent.id, usedCode)).toBe(true);
    // Usage unique : le meme code de secours ne refonctionne pas une 2e fois.
    expect(await verifyMfaCode(agent.id, usedCode)).toBe(false);

    const remaining = await testPrisma.user.findUniqueOrThrow({ where: { id: agent.id } });
    expect(remaining.mfaBackupCodes).toHaveLength(9);
  });

  it("l'auto-desactivation exige un code valide ; l'admin peut desactiver sans code (recuperation)", async () => {
    const agent = await createTestUser({});
    const { secret } = await beginMfaSetup(agent);
    await confirmMfaSetup(agent, await generate({ secret }));

    await expect(disableMfaSelf(agent, "000000")).rejects.toMatchObject({ status: 400 });
    let current = await testPrisma.user.findUniqueOrThrow({ where: { id: agent.id } });
    expect(current.mfaEnabled).toBe(true);

    await disableMfaSelf(agent, await generate({ secret }));
    current = await testPrisma.user.findUniqueOrThrow({ where: { id: agent.id } });
    expect(current.mfaEnabled).toBe(false);
    expect(current.mfaSecret).toBeNull();
    expect(current.mfaBackupCodes).toHaveLength(0);

    // Recuperation admin (perte de l'authenticator ET des codes de secours) :
    // reconfigure le MFA puis fait desactiver par un admin sans code, comme
    // resetUserPasswordByAdmin pour le mot de passe.
    const { secret: secret2 } = await beginMfaSetup(agent);
    await confirmMfaSetup(agent, await generate({ secret: secret2 }));

    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["users:edit"] });
    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });
    await expect(disableMfaByAdmin(noPerm, agent.id)).rejects.toMatchObject({ status: 403 });

    await disableMfaByAdmin(admin, agent.id);
    const afterAdminDisable = await testPrisma.user.findUniqueOrThrow({ where: { id: agent.id } });
    expect(afterAdminDisable.mfaEnabled).toBe(false);

    const audit = await testPrisma.auditLog.findFirst({ where: { action: "MFA_DISABLED_BY_ADMIN", entityId: agent.id } });
    expect(audit).not.toBeNull();
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
