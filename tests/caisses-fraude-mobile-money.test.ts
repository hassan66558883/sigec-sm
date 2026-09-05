import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { recordPayment } from "../src/lib/services/payments";
import { confirmMobileMoneyPayment } from "../src/lib/services/mobile-money";
import { openCashRegister, closeCashRegister } from "../src/lib/services/caisses";
import { createVersement } from "../src/lib/services/versements";
import { createCollector } from "../src/lib/services/collectors";
import bcrypt from "bcryptjs";
import {
  createTestCity,
  createTestArrondissement,
  createTestUser,
  createTestCitizen,
  testPrisma,
  uid,
  closeTestDb,
} from "./helpers/fixtures";

// Section 39 : tests 11 (ecart caisse) et 12 (Mobile Money duplique), plus
// le cycle honnete Mobile Money (jamais de succes simule) et le
// rapprochement versement -> caisse.
describe("caisses, versements, Mobile Money, controle anti-fraude", () => {
  let arrA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  async function makeAgent(admin: Awaited<ReturnType<typeof createTestUser>>) {
    const linkedUser = await createTestUser({ arrondissementIds: [arrA], permissions: [] });
    return createCollector(admin, { userId: linkedUser.id, arrondissementId: arrA });
  }

  it("un paiement Mobile Money reste PENDING sans reçu tant qu'il n'est pas confirme (jamais de succes simule)", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["payments:create"] });
    const owner = await createTestCitizen(arrA);

    const result = await recordPayment(admin, {
      payerId: owner.id,
      amount: 2000,
      paymentMethod: "MOBILE_MONEY",
      phoneNumber: "+23566000000",
      externalReference: uid("MMREF"),
    });

    expect(result.status).toBe("PENDING");
    expect(result.receipt).toBeNull();
    const receiptCount = await testPrisma.receipt.count({ where: { paymentId: result.id } });
    expect(receiptCount).toBe(0);
  });

  it("Test 12 — refuse d'enregistrer deux fois la meme reference de transaction Mobile Money (idempotence, regle absolue #5)", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["payments:create"] });
    const owner = await createTestCitizen(arrA);
    const ref = uid("MMREF");

    await recordPayment(admin, { payerId: owner.id, amount: 1000, paymentMethod: "MOBILE_MONEY", phoneNumber: "+23566000001", externalReference: ref });

    await expect(
      recordPayment(admin, { payerId: owner.id, amount: 1000, paymentMethod: "MOBILE_MONEY", phoneNumber: "+23566000001", externalReference: ref }),
    ).rejects.toMatchObject({ status: 409 });

    const alert = await testPrisma.fraudAlert.findFirst({ where: { type: "DOUBLE_PAYMENT" }, orderBy: { createdAt: "desc" } });
    expect(alert).not.toBeNull();
    expect(alert?.severity).toBe("CRITICAL");
  });

  it("confirmMobileMoneyPayment fait passer le paiement a PAID et genere le reçu — seulement a la confirmation", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["payments:create", "mobile_money:confirm"] });
    const owner = await createTestCitizen(arrA);

    const initiated = await recordPayment(admin, {
      payerId: owner.id,
      amount: 3000,
      paymentMethod: "MOBILE_MONEY",
      phoneNumber: "+23566000002",
      externalReference: uid("MMREF"),
    });
    const transaction = await testPrisma.mobileMoneyTransaction.findUniqueOrThrow({ where: { paymentId: initiated.id } });

    const receipt = await confirmMobileMoneyPayment(admin, transaction.id);
    expect(receipt.number).toMatch(/^REC-\d{4}-\d{8}$/);

    const paymentAfter = await testPrisma.payment.findUniqueOrThrow({ where: { id: initiated.id } });
    expect(paymentAfter.status).toBe("PAID");

    await expect(confirmMobileMoneyPayment(admin, transaction.id)).rejects.toMatchObject({ status: 400 });
  });

  it("Test 11 — un ecart de caisse a la cloture genere automatiquement une alerte", async () => {
    const admin = await createTestUser({
      organizationLevel: "CENTRAL",
      permissions: ["collectors:create", "caisses:create", "caisses:edit", "payments:create"],
    });
    const agent = await makeAgent(admin);
    const owner = await createTestCitizen(arrA);

    const caisse = await openCashRegister(admin, agent.id);
    await recordPayment(admin, { payerId: owner.id, amount: 5000, paymentMethod: "ESPECES", agentId: agent.id, arrondissementId: arrA, caisseId: caisse.id });

    // L'agent ne declare que 4000 alors que 5000 ont ete collectes en especes.
    const closed = await closeCashRegister(admin, caisse.id, 4000);
    expect(closed.expectedAmount).toBe(5000);
    expect(closed.discrepancy).toBe(-1000);

    const alert = await testPrisma.fraudAlert.findFirst({ where: { type: "CASH_DISCREPANCY", caisseId: caisse.id } });
    expect(alert).not.toBeNull();
  });

  it("un versement rapproche a la caisse ; un ecart de versement passe le statut a ECART", async () => {
    const admin = await createTestUser({
      organizationLevel: "CENTRAL",
      permissions: ["collectors:create", "caisses:create", "caisses:edit", "versements:create", "payments:create"],
    });
    const agent = await makeAgent(admin);
    const owner = await createTestCitizen(arrA);

    const caisse = await openCashRegister(admin, agent.id);
    await recordPayment(admin, { payerId: owner.id, amount: 2000, paymentMethod: "ESPECES", agentId: agent.id, arrondissementId: arrA, caisseId: caisse.id });
    await closeCashRegister(admin, caisse.id, 2000);

    const versement = await createVersement(admin, { caisseId: caisse.id, remittedAmount: 1500 });
    expect(versement.status).toBe("ECART");
    expect(versement.discrepancy).toBe(-500);

    await expect(createVersement(admin, { caisseId: caisse.id, remittedAmount: 1500 })).rejects.toMatchObject({ status: 409 });
  });

  it("une caisse ne peut pas etre ouverte deux fois pour le meme agent, ni cloturee deux fois", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["collectors:create", "caisses:create", "caisses:edit"] });
    const agent = await makeAgent(admin);

    const caisse = await openCashRegister(admin, agent.id);
    await expect(openCashRegister(admin, agent.id)).rejects.toMatchObject({ status: 409 });

    await closeCashRegister(admin, caisse.id, 0);
    await expect(closeCashRegister(admin, caisse.id, 0)).rejects.toMatchObject({ status: 400 });
  });

  it("un ecart de caisse notifie le superviseur reellement rattache a l'arrondissement (section 32)", async () => {
    const admin = await createTestUser({
      organizationLevel: "CENTRAL",
      permissions: ["collectors:create", "caisses:create", "caisses:edit", "payments:create"],
    });
    const agent = await makeAgent(admin);
    const owner = await createTestCitizen(arrA);

    // Cree un vrai superviseur en base (Role + Permission + UserRole reels,
    // pas seulement un CurrentUser synthetique) : notifyArrondissementSupervisors
    // interroge la base, pas un objet en memoire.
    const permission = await testPrisma.permission.findUniqueOrThrow({ where: { code: "fraud:resolve" } });
    const role = await testPrisma.role.create({ data: { code: uid("SUPERVISOR"), name: "Superviseur test" } });
    await testPrisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    const supervisorUser = await testPrisma.user.create({
      data: {
        name: "Superviseur Test",
        email: `${uid("sup")}@test.local`,
        password: await bcrypt.hash("Test1234!", 4),
        organizationLevel: "ARRONDISSEMENT",
      },
    });
    await testPrisma.userRole.create({ data: { userId: supervisorUser.id, roleId: role.id } });
    await testPrisma.userArrondissement.create({ data: { userId: supervisorUser.id, arrondissementId: arrA } });

    const caisse = await openCashRegister(admin, agent.id);
    await recordPayment(admin, { payerId: owner.id, amount: 1000, paymentMethod: "ESPECES", agentId: agent.id, arrondissementId: arrA, caisseId: caisse.id });
    await closeCashRegister(admin, caisse.id, 100);

    // where: title cible precisement la notification d'ecart de caisse — un
    // paiement enregistre en dehors des heures ouvrables notifie aussi ce
    // meme superviseur (detecteur "hors horaires" independant), et un
    // findFirst() non filtre sur le titre choisirait alors arbitrairement
    // entre les deux selon l'heure reelle d'execution du test.
    const notification = await testPrisma.staffNotification.findFirst({ where: { userId: supervisorUser.id, title: "Ecart de caisse" } });
    expect(notification).not.toBeNull();
  });

  it("la politique de geolocalisation BLOCK refuse une collecte sans position GPS, WARN l'autorise avec une alerte", async () => {
    const admin = await createTestUser({
      organizationLevel: "CENTRAL",
      permissions: ["collectors:create", "payments:create"],
    });
    const agent = await makeAgent(admin);
    const owner = await createTestCitizen(arrA);

    await testPrisma.systemSetting.upsert({
      where: { key: "geolocation_policy" },
      update: { value: { mode: "BLOCK" } },
      create: { key: "geolocation_policy", value: { mode: "BLOCK" } },
    });
    await expect(
      recordPayment(admin, { payerId: owner.id, amount: 500, paymentMethod: "ESPECES", agentId: agent.id, arrondissementId: arrA }),
    ).rejects.toMatchObject({ status: 400 });

    await testPrisma.systemSetting.update({ where: { key: "geolocation_policy" }, data: { value: { mode: "WARN" } } });
    const paid = await recordPayment(admin, { payerId: owner.id, amount: 500, paymentMethod: "ESPECES", agentId: agent.id, arrondissementId: arrA });
    expect(paid.status).toBe("PAID");

    await testPrisma.systemSetting.update({ where: { key: "geolocation_policy" }, data: { value: { mode: "ALLOW" } } });
  });
});
