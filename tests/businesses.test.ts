import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createBusiness, transferBusinessOwnership } from "../src/lib/services/businesses";
import { createOrReviseTariff } from "../src/lib/services/tariffs";
import { createObligation } from "../src/lib/services/obligations";
import { generateQrCode, resolveQrToken } from "../src/lib/services/qr-codes";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, testPrisma, uid, closeTestDb } from "./helpers/fixtures";

// Cession de propriete (module paiement QR, section 27) : change le
// proprietaire legal enregistre SANS jamais toucher l'historique deja
// emis (une obligation deja facturee reste due par qui l'a legitimement
// contractee) ni le QR actif (il identifie l'emplacement commercial,
// jamais la personne).
describe("cession de propriete (boutiques)", () => {
  let arrA: string;
  let arrB: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
    arrB = (await createTestArrondissement(city.id, 2)).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("transfere la propriete, journalise le motif, mais ne touche jamais l'historique des obligations ni le QR actif", async () => {
    const admin = await createTestUser({
      organizationLevel: "CENTRAL",
      permissions: ["businesses:create", "businesses:transfer", "tariffs:create", "obligations:create", "qr_codes:generate"],
    });
    const oldOwner = await createTestCitizen(arrA, { firstName: "Ancien", lastName: "Proprietaire" });
    const newOwner = await createTestCitizen(arrA, { firstName: "Nouveau", lastName: "Proprietaire" });
    const business = await createBusiness(admin, { name: uid("Boutique Cession"), ownerId: oldOwner.id, arrondissementId: arrA });

    const tarif = await createOrReviseTariff(admin, {
      code: uid("TARIF"),
      label: "Taxe test cession",
      emplacementType: "BOUTIQUE",
      periodicity: "MENSUELLE",
      amount: 4000,
    });
    const obligation = await createObligation(admin, { citizenId: oldOwner.id, businessId: business.id, tarifId: tarif.id, period: "2026-09", dueDate: "2026-09-30" });
    const qr = await generateQrCode(admin, "BUSINESS", business.id);

    const updated = await transferBusinessOwnership(admin, business.id, newOwner.id, "Vente du fonds de commerce.");
    expect(updated.ownerId).toBe(newOwner.id);

    // L'obligation deja emise reste attribuee a l'ANCIEN proprietaire.
    const obligationAfter = await testPrisma.obligationPaiement.findUniqueOrThrow({ where: { id: obligation.id } });
    expect(obligationAfter.citizenId).toBe(oldOwner.id);

    // Le QR reste actif et resout toujours vers la meme entite (jamais lie
    // au proprietaire).
    const scan = await resolveQrToken(qr.token);
    expect(scan.found).toBe(true);
    if (scan.found) expect(scan.valid).toBe(true);

    const audit = await testPrisma.auditLog.findFirst({ where: { action: "OWNERSHIP_TRANSFER", entityId: business.id } });
    expect(audit).not.toBeNull();
    expect((audit?.newValue as { reason?: string } | null)?.reason).toBe("Vente du fonds de commerce.");
  });

  it("refuse sans motif, sans permission, hors perimetre, vers un proprietaire inconnu, ou vers le meme proprietaire", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["businesses:create", "businesses:transfer"] });
    const owner = await createTestCitizen(arrA);
    const otherOwner = await createTestCitizen(arrA);
    const business = await createBusiness(admin, { name: uid("Boutique Refus"), ownerId: owner.id, arrondissementId: arrA });

    await expect(transferBusinessOwnership(admin, business.id, otherOwner.id, "")).rejects.toMatchObject({ status: 400 });

    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });
    await expect(transferBusinessOwnership(noPerm, business.id, otherOwner.id, "Motif.")).rejects.toMatchObject({ status: 403 });

    const outOfScope = await createTestUser({ arrondissementIds: [arrB], permissions: ["businesses:transfer"] });
    await expect(transferBusinessOwnership(outOfScope, business.id, otherOwner.id, "Motif.")).rejects.toMatchObject({ status: 403 });

    await expect(transferBusinessOwnership(admin, business.id, "introuvable", "Motif.")).rejects.toMatchObject({ status: 404 });

    await expect(transferBusinessOwnership(admin, business.id, owner.id, "Motif.")).rejects.toMatchObject({ status: 400 });
  });
});
