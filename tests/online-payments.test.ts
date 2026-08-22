import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createOrReviseTariff } from "../src/lib/services/tariffs";
import { createObligation } from "../src/lib/services/obligations";
import { recordPayment } from "../src/lib/services/payments";
import { confirmMobileMoneyPayment } from "../src/lib/services/mobile-money";
import { initiateOnlinePayment, listMyObligations, getMyObligation, handlePaymentCallback } from "../src/lib/services/online-payments";
import { refundPayment } from "../src/lib/services/refunds";
import {
  createTestCity,
  createTestArrondissement,
  createTestUser,
  createTestCitizen,
  createTestCitizenAccount,
  testPrisma,
  uid,
  closeTestDb,
} from "./helpers/fixtures";

// Module paiement en ligne (portail contribuable) — section 25 : tarification,
// paiement (reussi/en attente/callback repete/double paiement/transaction
// invalide/remboursement), securite (isolation contribuable, agent ne peut
// pas confirmer sans permission, seul un remboursement autorise change PAID).
describe("paiement en ligne — portail contribuable", () => {
  let arrA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  async function makeObligation(admin: Awaited<ReturnType<typeof createTestUser>>, amount: number) {
    const owner = await createTestCitizen(arrA);
    const tarif = await createOrReviseTariff(admin, {
      code: uid("TARIF"),
      label: "Taxe en ligne",
      emplacementType: "BOUTIQUE",
      periodicity: "MENSUELLE",
      amount,
    });
    const obligation = await createObligation(admin, {
      citizenId: owner.id,
      tarifId: tarif.id,
      period: "2026-08",
      dueDate: "2026-08-31",
    });
    const account = await createTestCitizenAccount(owner.id);
    return { owner, obligation, account };
  }

  it("initie un paiement en ligne PENDING pour le solde exact de l'obligation, sans reçu tant que non confirme", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["tariffs:create", "obligations:create"] });
    const { obligation, account } = await makeObligation(admin, 15000);

    const { payment, transaction, redirectUrl } = await initiateOnlinePayment(account, {
      obligationId: obligation.id,
      providerCode: "MANUAL",
    });

    expect(payment.status).toBe("PENDING");
    expect(payment.amount).toBe(15000);
    expect(transaction.channel).toBe("ONLINE");
    expect(transaction.status).toBe("INITIATED");
    expect(redirectUrl).toBeNull();
    const receiptCount = await testPrisma.receipt.count({ where: { paymentId: payment.id } });
    expect(receiptCount).toBe(0);
  });

  it("un contribuable ne peut ni voir ni payer l'obligation d'un autre contribuable", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["tariffs:create", "obligations:create"] });
    const { obligation } = await makeObligation(admin, 5000);
    const otherOwner = await createTestCitizen(arrA);
    const otherAccount = await createTestCitizenAccount(otherOwner.id);

    await expect(getMyObligation(otherAccount, obligation.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      initiateOnlinePayment(otherAccount, { obligationId: obligation.id, providerCode: "MANUAL" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("un agent autorise (mobile_money:confirm) peut confirmer un paiement en ligne exactement comme une collecte terrain — impute l'obligation et genere le reçu", async () => {
    const admin = await createTestUser({
      organizationLevel: "CENTRAL",
      permissions: ["tariffs:create", "obligations:create", "mobile_money:confirm"],
    });
    const { obligation, account } = await makeObligation(admin, 8000);
    const { transaction } = await initiateOnlinePayment(account, { obligationId: obligation.id, providerCode: "MANUAL" });

    const receipt = await confirmMobileMoneyPayment(admin, transaction.id);
    expect(receipt.number).toMatch(/^REC-\d{4}-\d{8}$/);

    const [remaining] = await listMyObligations(account);
    expect(remaining.status).toBe("PAYE");
    expect(remaining.balance).toBe(0);
  });

  it("le fournisseur MANUAL ne verifie jamais automatiquement une transaction : un callback public ne peut donc jamais faire passer un paiement a PAID (regle absolue : jamais de succes simule)", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["tariffs:create", "obligations:create"] });
    const { obligation, account } = await makeObligation(admin, 6000);
    const { payment, transaction } = await initiateOnlinePayment(account, { obligationId: obligation.id, providerCode: "MANUAL" });

    const result = await handlePaymentCallback("MANUAL", {
      internalReference: transaction.internalReference,
      providerTransactionId: uid("FAKE-EXT-REF"),
      status: "SUCCESS",
      amount: 6000,
    }, {});

    if (!result.ok || result.alreadyProcessed) throw new Error("callback aurait du etre traite une premiere fois");
    expect(result.status).toBe("FAILED");
    const paymentAfter = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paymentAfter.status).toBe("ECHEC");
  });

  it("un callback redelivre pour une transaction deja traitee est idempotent (ne rejoue rien)", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["tariffs:create", "obligations:create"] });
    const { obligation, account } = await makeObligation(admin, 4000);
    const { transaction } = await initiateOnlinePayment(account, { obligationId: obligation.id, providerCode: "MANUAL" });

    const payload = { internalReference: transaction.internalReference, providerTransactionId: uid("REF"), status: "SUCCESS" as const, amount: 4000 };
    const first = await handlePaymentCallback("MANUAL", payload, {});
    const second = await handlePaymentCallback("MANUAL", payload, {});

    if (!first.ok) throw new Error("premier callback aurait du etre accepte");
    if (!second.ok) throw new Error("second callback aurait du etre accepte");
    expect(first.alreadyProcessed).toBe(false);
    expect(second.alreadyProcessed).toBe(true);
    const alertCount = await testPrisma.fraudAlert.count({ where: { description: { contains: transaction.id } } });
    expect(alertCount).toBeLessThanOrEqual(1);
  });

  it("un webhook a la charge utile malformee est ignore sans exception", async () => {
    const result = await handlePaymentCallback("MANUAL", { garbage: true }, {});
    expect(result.ok).toBe(false);
  });

  it("refundPayment rembourse un paiement PAID, fait baisser paidAmount de l'obligation et refuse un second remboursement", async () => {
    const admin = await createTestUser({
      organizationLevel: "CENTRAL",
      permissions: ["tariffs:create", "obligations:create", "payments:create", "payments:refund"],
    });
    const owner = await createTestCitizen(arrA);
    const tarif = await createOrReviseTariff(admin, { code: uid("TARIF"), label: "Taxe", emplacementType: "BOUTIQUE", periodicity: "MENSUELLE", amount: 9000 });
    const obligation = await createObligation(admin, { citizenId: owner.id, tarifId: tarif.id, period: "2026-08", dueDate: "2026-08-31" });
    const payment = await recordPayment(admin, { payerId: owner.id, amount: 9000, paymentMethod: "ESPECES", obligationId: obligation.id });

    await expect(refundPayment(admin, payment.id, "")).rejects.toMatchObject({ status: 400 });

    const refund = await refundPayment(admin, payment.id, "Erreur de saisie du montant");
    expect(refund.amount).toBe(9000);

    const paymentAfter = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paymentAfter.status).toBe("REMBOURSE");
    const obligationAfter = await testPrisma.obligationPaiement.findUniqueOrThrow({ where: { id: obligation.id } });
    expect(obligationAfter.paidAmount).toBe(0);
    expect(obligationAfter.status).toBe("A_PAYER");

    await expect(refundPayment(admin, payment.id, "Deuxieme tentative")).rejects.toMatchObject({ status: 400 });
  });

  it("un agent sans payments:refund ne peut pas rembourser", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["tariffs:create", "obligations:create", "payments:create", "payments:refund"] });
    const limitedAgent = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["payments:create"] });
    const owner = await createTestCitizen(arrA);
    const tarif = await createOrReviseTariff(admin, { code: uid("TARIF"), label: "Taxe", emplacementType: "BOUTIQUE", periodicity: "MENSUELLE", amount: 2000 });
    const obligation = await createObligation(admin, { citizenId: owner.id, tarifId: tarif.id, period: "2026-08", dueDate: "2026-08-31" });
    const payment = await recordPayment(admin, { payerId: owner.id, amount: 2000, paymentMethod: "ESPECES", obligationId: obligation.id });

    await expect(refundPayment(limitedAgent, payment.id, "Motif")).rejects.toMatchObject({ status: 403 });
  });
});
