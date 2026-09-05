import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createBusiness } from "../src/lib/services/businesses";
import { createOrReviseTariff } from "../src/lib/services/tariffs";
import { createObligation } from "../src/lib/services/obligations";
import {
  generateQrCode,
  revokeQrCode,
  replaceQrCode,
  confirmQrInstallation,
  inspectQrCode,
  listQrCodesForEntity,
  resolveQrToken,
} from "../src/lib/services/qr-codes";
import {
  createTestCity,
  createTestArrondissement,
  createTestUser,
  createTestCitizen,
  testPrisma,
  uid,
  closeTestDb,
} from "./helpers/fixtures";

// Module paiement QR — systeme reutilisable (section 3). Verifie les regles
// absolues du cahier des charges : #2 (jamais de montant fige dans le QR —
// le solde est toujours recalcule au scan), le fait qu'un QR n'est jamais
// supprime (revocation/remplacement uniquement, historique complet via
// QrCodeEvent), et qu'aucune donnee personnelle n'est exposee au scan public.
describe("module paiement QR — generation, revocation, remplacement, scan public", () => {
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

  it("genere un QR pour une boutique, refuse un deuxieme QR actif concurrent, respecte le perimetre territorial", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["businesses:create", "qr_codes:generate", "qr_codes:view"] });
    const owner = await createTestCitizen(arrA);
    const business = await createBusiness(agent, { name: "Boutique QR", ownerId: owner.id, arrondissementId: arrA });

    const noPerm = await createTestUser({ arrondissementIds: [arrA], permissions: [] });
    await expect(generateQrCode(noPerm, "BUSINESS", business.id)).rejects.toMatchObject({ status: 403 });

    const outOfScope = await createTestUser({ arrondissementIds: [arrB], permissions: ["qr_codes:generate"] });
    await expect(generateQrCode(outOfScope, "BUSINESS", business.id)).rejects.toMatchObject({ status: 403 });

    const qr = await generateQrCode(agent, "BUSINESS", business.id);
    expect(qr.status).toBe("ACTIVE");
    expect(qr.token).toHaveLength(32); // randomBytes(24).toString("base64url")

    // Un deuxieme QR actif pour la meme entite est refuse (une seule entite -> un seul QR actif).
    await expect(generateQrCode(agent, "BUSINESS", business.id)).rejects.toMatchObject({ status: 400 });

    const list = await listQrCodesForEntity(agent, "BUSINESS", business.id);
    expect(list.map((q) => q.id)).toContain(qr.id);
  });

  it("revoque un QR (motif obligatoire, jamais de suppression) puis le scan public le signale invalide", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["businesses:create", "qr_codes:generate", "qr_codes:revoke"] });
    const owner = await createTestCitizen(arrA);
    const business = await createBusiness(agent, { name: "Boutique Revoque", ownerId: owner.id, arrondissementId: arrA });
    const qr = await generateQrCode(agent, "BUSINESS", business.id);

    await expect(revokeQrCode(agent, qr.id, "")).rejects.toMatchObject({ status: 400 });

    const revoked = await revokeQrCode(agent, qr.id, "Sticker vole.");
    expect(revoked.status).toBe("REVOKED");
    expect(revoked.revokedReason).toBe("Sticker vole.");

    // Revoquer a nouveau un QR deja revoque est refuse.
    await expect(revokeQrCode(agent, qr.id, "Encore.")).rejects.toMatchObject({ status: 400 });

    // Le scan public le trouve mais le signale invalide — jamais supprime en base.
    const scan = await resolveQrToken(qr.token);
    expect(scan.found).toBe(true);
    if (scan.found) {
      expect(scan.valid).toBe(false);
      expect(scan.status).toBe("REVOKED");
    }
    const stillInDb = await testPrisma.qrCode.findUnique({ where: { id: qr.id } });
    expect(stillInDb).not.toBeNull();
  });

  it("remplace un QR (perte/vol) : l'ancien passe REPLACED, le nouveau est lie et devient le seul actif", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["businesses:create", "qr_codes:generate", "qr_codes:replace"] });
    const owner = await createTestCitizen(arrA);
    const business = await createBusiness(agent, { name: "Boutique Remplace", ownerId: owner.id, arrondissementId: arrA });
    const original = await generateQrCode(agent, "BUSINESS", business.id);

    const replacement = await replaceQrCode(agent, original.id, "Sticker degrade, illisible.");
    expect(replacement.replacesId).toBe(original.id);
    expect(replacement.status).toBe("ACTIVE");
    expect(replacement.token).not.toBe(original.token);

    const oldAfter = await testPrisma.qrCode.findUnique({ where: { id: original.id } });
    expect(oldAfter?.status).toBe("REPLACED");

    // L'ancien token ne resout plus vers un QR valide.
    const oldScan = await resolveQrToken(original.token);
    expect(oldScan.found && oldScan.valid).toBe(false);
    const newScan = await resolveQrToken(replacement.token);
    expect(newScan.found && newScan.valid).toBe(true);
  });

  it("le scan public calcule le solde a la volee depuis les obligations reelles, sans jamais exposer de donnee personnelle du proprietaire", async () => {
    const admin = await createTestUser({
      organizationLevel: "CENTRAL",
      permissions: ["businesses:create", "tariffs:create", "obligations:create", "qr_codes:generate"],
    });
    const owner = await createTestCitizen(arrA, { firstName: "Confidentiel", lastName: "Prive" });
    const business = await createBusiness(admin, { name: "Boutique Solde", ownerId: owner.id, arrondissementId: arrA });
    const tarif = await createOrReviseTariff(admin, {
      code: uid("TARIF"),
      label: "Taxe test QR",
      emplacementType: "BOUTIQUE",
      periodicity: "MENSUELLE",
      amount: 12000,
    });
    await createObligation(admin, { citizenId: owner.id, businessId: business.id, tarifId: tarif.id, period: "2026-09", dueDate: "2026-09-30" });

    const qr = await generateQrCode(admin, "BUSINESS", business.id);
    const scan = await resolveQrToken(qr.token);

    expect(scan.found).toBe(true);
    if (!scan.found) return;
    expect(scan.valid).toBe(true);
    expect(scan.name).toBe("Boutique Solde");
    expect(scan.outstanding.total).toBe(12000);
    expect(scan.outstanding.obligations).toHaveLength(1);
    // Jamais le nom du proprietaire (donnee personnelle) dans la reponse du scan public.
    expect(JSON.stringify(scan)).not.toContain("Confidentiel");
    expect(JSON.stringify(scan)).not.toContain("Prive");
  });

  it("un token inconnu renvoie found:false (aucune fuite d'information sur l'existence d'un QR)", async () => {
    const scan = await resolveQrToken("un-token-qui-n-existe-pas");
    expect(scan.found).toBe(false);
  });

  it("fonctionne aussi pour un emplacement de marche (MARKET_STALL) — meme moteur, aucune duplication de code", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["markets:create", "qr_codes:generate"] });
    const market = await testPrisma.market.create({ data: { name: uid("Marche"), arrondissementId: arrA } });
    const stall = await testPrisma.marketStall.create({ data: { marketId: market.id, code: "A12" } });

    const qr = await generateQrCode(admin, "MARKET_STALL", stall.id);
    const scan = await resolveQrToken(qr.token);
    expect(scan.found).toBe(true);
    if (scan.found) {
      expect(scan.entityType).toBe("MARKET_STALL");
      expect(scan.name).toContain("A12");
    }
  });

  it("confirme une pose terrain (GPS/date/agent) et l'inspection admin renvoie l'historique complet", async () => {
    const agent = await createTestUser({
      arrondissementIds: [arrA],
      permissions: ["businesses:create", "qr_codes:generate", "qr_codes:verify_install", "qr_codes:view"],
    });
    const owner = await createTestCitizen(arrA);
    const business = await createBusiness(agent, { name: "Boutique Install", ownerId: owner.id, arrondissementId: arrA });
    const qr = await generateQrCode(agent, "BUSINESS", business.id);

    const installed = await confirmQrInstallation(agent, qr.id, { lat: 12.13, lng: 15.05 });
    expect(installed.installedAt).not.toBeNull();
    expect(installed.installGpsLat).toBe(12.13);

    const inspected = await inspectQrCode(agent, qr.id);
    expect(inspected.entityLabel).toBe("Boutique Install");
    const eventTypes = inspected.events.map((e) => e.event);
    expect(eventTypes).toEqual(expect.arrayContaining(["GENERATED", "INSTALLED"]));
  });
});
