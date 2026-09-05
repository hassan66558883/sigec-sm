import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createBusiness } from "../src/lib/services/businesses";
import { generateQrCode, bulkGenerateQrStickers } from "../src/lib/services/qr-codes";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, testPrisma, uid, closeTestDb } from "./helpers/fixtures";

const BASE_URL = "https://sigec-sm.example";

// Generation groupee de stickers QR imprimables (module paiement QR,
// section 38) — verifie que le PDF produit est reel (en-tete %PDF-, pas un
// buffer vide), qu'une entite deja equipee n'est JAMAIS regeneree (un seul
// QR actif par entite, regle deja imposee par generateQrCode()), et que le
// perimetre territorial est respecte silencieusement (une entite hors
// perimetre est simplement omise du lot, pas une erreur qui bloquerait les
// autres).
describe("generation groupee de stickers QR", () => {
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

  it("produit un vrai PDF, reutilise un QR deja actif, en genere un nouveau si absent, ignore le hors perimetre", async () => {
    const admin = await createTestUser({
      arrondissementIds: [arrA],
      permissions: ["businesses:create", "qr_codes:generate", "qr_codes:bulk_generate"],
    });
    const owner = await createTestCitizen(arrA);
    const businessWithQr = await createBusiness(admin, { name: uid("Boutique Avec QR"), ownerId: owner.id, arrondissementId: arrA });
    const businessWithoutQr = await createBusiness(admin, { name: uid("Boutique Sans QR"), ownerId: owner.id, arrondissementId: arrA });
    const existingQr = await generateQrCode(admin, "BUSINESS", businessWithQr.id);

    // Entite hors du perimetre de l'agent (arrondissement different).
    const otherOwner = await createTestCitizen(arrB);
    const outOfScopeBusiness = await createBusiness(
      await createTestUser({ organizationLevel: "CENTRAL", permissions: ["businesses:create"] }),
      { name: uid("Boutique Hors Perimetre"), ownerId: otherOwner.id, arrondissementId: arrB },
    );

    const pdf = await bulkGenerateQrStickers(admin, "BUSINESS", [businessWithQr.id, businessWithoutQr.id, outOfScopeBusiness.id], BASE_URL);

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);

    // L'entite qui avait deja un QR actif n'en a PAS un second.
    const qrsForBusinessWithQr = await testPrisma.qrCode.findMany({ where: { entityType: "BUSINESS", entityId: businessWithQr.id } });
    expect(qrsForBusinessWithQr).toHaveLength(1);
    expect(qrsForBusinessWithQr[0].id).toBe(existingQr.id);

    // L'entite qui n'en avait pas en a maintenant un.
    const qrsForBusinessWithoutQr = await testPrisma.qrCode.findMany({ where: { entityType: "BUSINESS", entityId: businessWithoutQr.id, status: "ACTIVE" } });
    expect(qrsForBusinessWithoutQr).toHaveLength(1);

    // L'entite hors perimetre n'a recu aucun QR (ignoree silencieusement).
    const qrsOutOfScope = await testPrisma.qrCode.findMany({ where: { entityType: "BUSINESS", entityId: outOfScopeBusiness.id } });
    expect(qrsOutOfScope).toHaveLength(0);

    const audit = await testPrisma.auditLog.findFirst({ where: { action: "QR_BULK_GENERATE" }, orderBy: { createdAt: "desc" } });
    expect(audit).not.toBeNull();
    expect((audit?.newValue as { produced?: number } | null)?.produced).toBe(2); // seules les 2 entites dans le perimetre
  });

  it("refuse sans permission, un type invalide, une liste vide, plus de 200 entites, et si aucune entite n'est valide", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["businesses:create", "qr_codes:generate", "qr_codes:bulk_generate"] });
    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });
    const owner = await createTestCitizen(arrA);
    const business = await createBusiness(admin, { name: uid("Boutique Refus Lot"), ownerId: owner.id, arrondissementId: arrA });

    await expect(bulkGenerateQrStickers(noPerm, "BUSINESS", [business.id], BASE_URL)).rejects.toMatchObject({ status: 403 });
    await expect(bulkGenerateQrStickers(admin, "INCONNU", [business.id], BASE_URL)).rejects.toMatchObject({ status: 400 });
    await expect(bulkGenerateQrStickers(admin, "BUSINESS", [], BASE_URL)).rejects.toMatchObject({ status: 400 });
    await expect(bulkGenerateQrStickers(admin, "BUSINESS", Array.from({ length: 201 }, () => business.id), BASE_URL)).rejects.toMatchObject({ status: 400 });
    await expect(bulkGenerateQrStickers(admin, "BUSINESS", ["introuvable-1", "introuvable-2"], BASE_URL)).rejects.toMatchObject({ status: 400 });
  });
});
