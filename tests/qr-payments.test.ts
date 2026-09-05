import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createBusiness } from "../src/lib/services/businesses";
import { createOrReviseTariff } from "../src/lib/services/tariffs";
import { createObligation } from "../src/lib/services/obligations";
import { generateQrCode, revokeQrCode } from "../src/lib/services/qr-codes";
import { initiateQrPayment } from "../src/lib/services/qr-payments";
import { confirmMobileMoneyPayment } from "../src/lib/services/mobile-money";
import { verifyReceiptPublic } from "../src/lib/services/receipts";
import {
  createTestCity,
  createTestArrondissement,
  createTestUser,
  createTestCitizen,
  testPrisma,
  uid,
  closeTestDb,
} from "./helpers/fixtures";

// Chaine complete "scan -> paiement anonyme -> confirmation agent -> reçu"
// (module paiement QR, section 56 : critere de reussite explicite du
// cahier des charges) — sans jamais exiger de compte citoyen pour le
// passant qui scanne (section 41), et sans jamais marquer un paiement
// reussi avant confirmation reelle (regle absolue section 11).
describe("module paiement QR — initiation de paiement anonyme", () => {
  let arrA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("chaine complete : scan -> paiement QR anonyme -> confirmation agent -> reçu verifiable -> obligation soldee", async () => {
    const admin = await createTestUser({
      organizationLevel: "CENTRAL",
      permissions: ["businesses:create", "tariffs:create", "obligations:create", "qr_codes:generate", "mobile_money:confirm"],
    });
    const owner = await createTestCitizen(arrA, { firstName: "Proprietaire", lastName: "Test" });
    const business = await createBusiness(admin, { name: "Boutique Paiement QR", ownerId: owner.id, arrondissementId: arrA });
    const tarif = await createOrReviseTariff(admin, {
      code: uid("TARIF"),
      label: "Taxe test paiement QR",
      emplacementType: "BOUTIQUE",
      periodicity: "MENSUELLE",
      amount: 20000,
    });
    const obligation = await createObligation(admin, {
      citizenId: owner.id,
      businessId: business.id,
      tarifId: tarif.id,
      period: "2026-09",
      dueDate: "2026-09-30",
    });
    const qr = await generateQrCode(admin, "BUSINESS", business.id);

    // Le passant scanne (aucune authentification) et initie le paiement.
    const { payment, transaction } = await initiateQrPayment(qr.token, { obligationId: obligation.id, providerCode: "MANUAL" });
    expect(payment.status).toBe("PENDING");
    expect(payment.collectedById).toBeNull(); // aucun acteur identifie
    expect(payment.payerId).toBe(owner.id); // le payeur legal reste le proprietaire enregistre
    expect(transaction.channel).toBe("QR");
    expect(transaction.status).toBe("INITIATED");

    // Jamais reussi avant confirmation reelle par un agent autorise.
    const beforeConfirm = await testPrisma.payment.findUnique({ where: { id: payment.id } });
    expect(beforeConfirm?.status).toBe("PENDING");

    const receipt = await confirmMobileMoneyPayment(admin, transaction.id);
    const afterConfirm = await testPrisma.payment.findUnique({ where: { id: payment.id } });
    expect(afterConfirm?.status).toBe("PAID");

    const obligationAfter = await testPrisma.obligationPaiement.findUnique({ where: { id: obligation.id } });
    expect(obligationAfter?.status).toBe("PAYE");
    expect(obligationAfter?.paidAmount).toBe(20000);

    const verification = await verifyReceiptPublic(receipt.qrToken);
    expect(verification.found).toBe(true);
    expect(verification.valid).toBe(true);
    if (verification.found) expect(verification.amount).toBe(20000);
  });

  it("refuse un QR revoque, une facture d'une autre entite, une facture deja soldee/annulee ou a solde nul", async () => {
    const admin = await createTestUser({
      organizationLevel: "CENTRAL",
      permissions: ["businesses:create", "tariffs:create", "obligations:create", "qr_codes:generate", "qr_codes:revoke"],
    });
    const owner = await createTestCitizen(arrA);
    const business = await createBusiness(admin, { name: "Boutique Refus", ownerId: owner.id, arrondissementId: arrA });
    const otherBusiness = await createBusiness(admin, { name: "Autre Boutique", ownerId: owner.id, arrondissementId: arrA });
    const tarif = await createOrReviseTariff(admin, {
      code: uid("TARIF"),
      label: "Taxe test refus",
      emplacementType: "BOUTIQUE",
      periodicity: "MENSUELLE",
      amount: 5000,
    });
    const obligation = await createObligation(admin, { citizenId: owner.id, businessId: business.id, tarifId: tarif.id, period: "2026-09", dueDate: "2026-09-30" });
    const otherObligation = await createObligation(admin, { citizenId: owner.id, businessId: otherBusiness.id, tarifId: tarif.id, period: "2026-09", dueDate: "2026-09-30" });

    const qr = await generateQrCode(admin, "BUSINESS", business.id);

    // Une facture d'une AUTRE entite ne peut jamais etre reglee via ce QR.
    await expect(initiateQrPayment(qr.token, { obligationId: otherObligation.id, providerCode: "MANUAL" })).rejects.toMatchObject({ status: 404 });

    await revokeQrCode(admin, qr.id, "Test.");
    await expect(initiateQrPayment(qr.token, { obligationId: obligation.id, providerCode: "MANUAL" })).rejects.toMatchObject({ status: 404 });

    const qr2 = await generateQrCode(admin, "BUSINESS", business.id);
    await testPrisma.obligationPaiement.update({ where: { id: obligation.id }, data: { status: "ANNULE" } });
    await expect(initiateQrPayment(qr2.token, { obligationId: obligation.id, providerCode: "MANUAL" })).rejects.toMatchObject({ status: 400 });

    await testPrisma.obligationPaiement.update({ where: { id: obligation.id }, data: { status: "A_PAYER", paidAmount: 5000 } });
    await expect(initiateQrPayment(qr2.token, { obligationId: obligation.id, providerCode: "MANUAL" })).rejects.toMatchObject({ status: 400 });
  });

  it("fonctionne pour un emplacement de marche : le payeur legal est l'occupant enregistre ; refuse si aucun occupant", async () => {
    const admin = await createTestUser({
      organizationLevel: "CENTRAL",
      permissions: ["tariffs:create", "obligations:create", "qr_codes:generate"],
    });
    const occupant = await createTestCitizen(arrA, { firstName: "Occupant", lastName: "Marche" });
    const market = await testPrisma.market.create({ data: { name: uid("Marche"), arrondissementId: arrA } });
    const stallNoOccupant = await testPrisma.marketStall.create({ data: { marketId: market.id, code: "B01" } });
    const stall = await testPrisma.marketStall.create({ data: { marketId: market.id, code: "B02", occupantId: occupant.id } });
    const tarif = await createOrReviseTariff(admin, {
      code: uid("TARIF"),
      label: "Taxe test marche",
      emplacementType: "ETAL",
      periodicity: "JOURNALIERE",
      amount: 1000,
    });
    const obligation = await createObligation(admin, { citizenId: occupant.id, marketStallId: stall.id, tarifId: tarif.id, period: "2026-09-05", dueDate: "2026-09-05" });

    const qrNoOccupant = await generateQrCode(admin, "MARKET_STALL", stallNoOccupant.id);
    const obligationNoOccupant = await createObligation(admin, { citizenId: occupant.id, marketStallId: stallNoOccupant.id, tarifId: tarif.id, period: "2026-09-05", dueDate: "2026-09-05" });
    await expect(initiateQrPayment(qrNoOccupant.token, { obligationId: obligationNoOccupant.id, providerCode: "MANUAL" })).rejects.toMatchObject({ status: 400 });

    const qr = await generateQrCode(admin, "MARKET_STALL", stall.id);
    const { payment } = await initiateQrPayment(qr.token, { obligationId: obligation.id, providerCode: "MANUAL" });
    expect(payment.payerId).toBe(occupant.id);
  });
});
