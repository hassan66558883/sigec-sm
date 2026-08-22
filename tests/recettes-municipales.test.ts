import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createBusiness } from "../src/lib/services/businesses";
import { createOrReviseTariff } from "../src/lib/services/tariffs";
import { createObligation, listObligations } from "../src/lib/services/obligations";
import { recordPayment, cancelPayment } from "../src/lib/services/payments";
import { verifyReceiptPublic } from "../src/lib/services/receipts";
import { createCollector, assignZone, isAgentAssignedToZone } from "../src/lib/services/collectors";
import {
  createTestCity,
  createTestArrondissement,
  createTestUser,
  createTestCitizen,
  testPrisma,
  uid,
  closeTestDb,
} from "./helpers/fixtures";

// Chaine complete du module "recettes municipales" (section 45 : critere de
// reussite) : recensement -> boutique -> tarif -> obligation -> agent ->
// paiement -> reçu -> verification -> annulation. Regles absolues (section
// 35) verifiees explicitement : #1 (jamais de suppression), #2 (reçu jamais
// reutilise), #3/#4 (numeros jamais dupliques), #6 (motif obligatoire).
describe("recettes municipales — chaine complete", () => {
  let arrA: string;
  let arrB: string;
  let quartierA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
    arrB = (await createTestArrondissement(city.id, 2)).id;
    quartierA = (
      await testPrisma.quartier.create({ data: { arrondissementId: arrA, name: uid("Quartier"), code: uid("Q") } })
    ).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("Test 3 — cree une boutique avec un code d'emplacement structure, jamais duplique", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["businesses:create"] });
    const owner = await createTestCitizen(arrA);

    const b1 = await createBusiness(agent, { name: "Boutique A", ownerId: owner.id, arrondissementId: arrA });
    const b2 = await createBusiness(agent, { name: "Boutique B", ownerId: owner.id, arrondissementId: arrA });

    expect(b1.code).toMatch(/^NDJ-A\d{2}-BT-\d{6}$/);
    expect(b1.code).not.toBe(b2.code);
  });

  it("Test 4 — genere une obligation dont le montant vient du referentiel tarifaire (jamais saisi librement)", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["tariffs:create", "obligations:create", "businesses:create"] });
    const owner = await createTestCitizen(arrA);
    const business = await createBusiness(admin, { name: "Boutique tarif", ownerId: owner.id, arrondissementId: arrA });
    const tarif = await createOrReviseTariff(admin, {
      code: uid("TARIF"),
      label: "Taxe test",
      emplacementType: "BOUTIQUE",
      periodicity: "MENSUELLE",
      amount: 7000,
    });

    const obligation = await createObligation(admin, {
      citizenId: owner.id,
      businessId: business.id,
      tarifId: tarif.id,
      period: "2026-08",
      dueDate: "2026-08-31",
    });

    expect(obligation.initialAmount).toBe(7000);
    expect(obligation.balance).toBe(7000);
    expect(obligation.status).toBe("A_PAYER");
  });

  it("un tarif n'est jamais ecrase : une revision cloture l'ancienne version et en cree une nouvelle", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["tariffs:create"] });
    const code = uid("TARIF");
    const v1 = await createOrReviseTariff(admin, { code, label: "V1", emplacementType: "ETAL", periodicity: "JOURNALIERE", amount: 500 });
    const v2 = await createOrReviseTariff(admin, { code, label: "V2", emplacementType: "ETAL", periodicity: "JOURNALIERE", amount: 800 });

    expect(v1.id).not.toBe(v2.id);
    const reloadedV1 = await testPrisma.tarifMunicipal.findUniqueOrThrow({ where: { id: v1.id } });
    expect(reloadedV1.status).toBe("INACTIF");
    expect(reloadedV1.endDate).not.toBeNull();
    expect(v2.status).toBe("ACTIF");
  });

  it("Test 5+6 — un paiement sur une obligation genere un reçu, met a jour le solde et le statut", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["tariffs:create", "obligations:create", "businesses:create", "payments:create"] });
    const owner = await createTestCitizen(arrA);
    const business = await createBusiness(admin, { name: "Boutique paiement", ownerId: owner.id, arrondissementId: arrA });
    const tarif = await createOrReviseTariff(admin, { code: uid("TARIF"), label: "Taxe", emplacementType: "BOUTIQUE", periodicity: "MENSUELLE", amount: 10000 });
    const obligation = await createObligation(admin, { citizenId: owner.id, businessId: business.id, tarifId: tarif.id, period: "2026-08", dueDate: "2026-08-31" });

    const result = await recordPayment(admin, { payerId: owner.id, amount: 4000, paymentMethod: "ESPECES", obligationId: obligation.id });
    expect(result.receipt).toBeDefined();
    expect(result.receipt.number).toMatch(/^REC-\d{4}-\d{8}$/);

    const afterPartial = await testPrisma.obligationPaiement.findUniqueOrThrow({ where: { id: obligation.id } });
    expect(afterPartial.paidAmount).toBe(4000);
    expect(afterPartial.status).toBe("PARTIELLEMENT_PAYE");

    const result2 = await recordPayment(admin, { payerId: owner.id, amount: 6000, paymentMethod: "ESPECES", obligationId: obligation.id });
    expect(result2.receipt.number).not.toBe(result.receipt.number);

    const afterFull = await testPrisma.obligationPaiement.findUniqueOrThrow({ where: { id: obligation.id } });
    expect(afterFull.paidAmount).toBe(10000);
    expect(afterFull.status).toBe("PAYE");
  });

  it("Test 7 — un reçu est verifiable publiquement sans authentification, sans exposer le nom du contribuable", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["payments:create"] });
    const owner = await createTestCitizen(arrA, { lastName: "NomSecret" });

    const result = await recordPayment(admin, { payerId: owner.id, amount: 5000, paymentMethod: "ESPECES" });
    const receiptRow = await testPrisma.receipt.findUniqueOrThrow({ where: { id: result.receipt.id } });

    const publicView = await verifyReceiptPublic(receiptRow.qrToken);
    expect(publicView.found).toBe(true);
    if (publicView.found) {
      expect(publicView.valid).toBe(true);
      expect(publicView.amount).toBe(5000);
      expect(JSON.stringify(publicView)).not.toContain("NomSecret");
    }
  });

  it("Test 9+10 — annuler un paiement ne le supprime jamais (regle absolue #1), exige un motif (#6) et reverse l'obligation", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["tariffs:create", "obligations:create", "businesses:create", "payments:create", "payments:cancel"] });
    const owner = await createTestCitizen(arrA);
    const business = await createBusiness(admin, { name: "Boutique annulation", ownerId: owner.id, arrondissementId: arrA });
    const tarif = await createOrReviseTariff(admin, { code: uid("TARIF"), label: "Taxe", emplacementType: "BOUTIQUE", periodicity: "MENSUELLE", amount: 3000 });
    const obligation = await createObligation(admin, { citizenId: owner.id, businessId: business.id, tarifId: tarif.id, period: "2026-08", dueDate: "2026-08-31" });
    const result = await recordPayment(admin, { payerId: owner.id, amount: 3000, paymentMethod: "ESPECES", obligationId: obligation.id });

    await expect(cancelPayment(admin, result.id, "")).rejects.toMatchObject({ status: 400 });

    await cancelPayment(admin, result.id, "Erreur de saisie du montant");

    const stillExists = await testPrisma.payment.findUniqueOrThrow({ where: { id: result.id } });
    expect(stillExists.status).toBe("ANNULE");
    expect(stillExists.id).toBe(result.id);

    const obligationAfter = await testPrisma.obligationPaiement.findUniqueOrThrow({ where: { id: obligation.id } });
    expect(obligationAfter.paidAmount).toBe(0);
    expect(obligationAfter.status).toBe("A_PAYER");

    const receiptAfter = await testPrisma.receipt.findUniqueOrThrow({ where: { paymentId: result.id } });
    expect(receiptAfter.status).toBe("ANNULE");
  });

  it("un agent d'arrondissement ne peut pas encaisser une obligation d'un autre arrondissement (isolation territoriale)", async () => {
    const adminA = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["tariffs:create", "obligations:create", "businesses:create"] });
    const agentB = await createTestUser({ arrondissementIds: [arrB], permissions: ["payments:create"] });
    const owner = await createTestCitizen(arrA);
    const business = await createBusiness(adminA, { name: "Boutique isolee", ownerId: owner.id, arrondissementId: arrA });
    const tarif = await createOrReviseTariff(adminA, { code: uid("TARIF"), label: "Taxe", emplacementType: "BOUTIQUE", periodicity: "MENSUELLE", amount: 2000 });
    const obligation = await createObligation(adminA, { citizenId: owner.id, businessId: business.id, tarifId: tarif.id, period: "2026-08", dueDate: "2026-08-31" });

    await expect(
      recordPayment(agentB, { payerId: owner.id, amount: 2000, paymentMethod: "ESPECES", obligationId: obligation.id }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("le Maire central (vision globale) voit les obligations des deux arrondissements, un agent local ne voit que le sien", async () => {
    const adminCentral = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["tariffs:create", "obligations:create", "obligations:view", "businesses:create"] });
    const ownerA = await createTestCitizen(arrA);
    const ownerB = await createTestCitizen(arrB);
    const businessA = await createBusiness(adminCentral, { name: "Boutique A", ownerId: ownerA.id, arrondissementId: arrA });
    const businessB = await createBusiness(adminCentral, { name: "Boutique B", ownerId: ownerB.id, arrondissementId: arrB });
    const tarif = await createOrReviseTariff(adminCentral, { code: uid("TARIF"), label: "Taxe", emplacementType: "BOUTIQUE", periodicity: "MENSUELLE", amount: 1000 });
    await createObligation(adminCentral, { citizenId: ownerA.id, businessId: businessA.id, tarifId: tarif.id, period: "2026-08", dueDate: "2026-08-31" });
    await createObligation(adminCentral, { citizenId: ownerB.id, businessId: businessB.id, tarifId: tarif.id, period: "2026-08", dueDate: "2026-08-31" });

    const globalView = await listObligations(adminCentral, {});
    const ids = globalView.map((o) => o.tarifId);
    expect(ids.length).toBeGreaterThanOrEqual(2);

    const agentA = await createTestUser({ arrondissementIds: [arrA], permissions: ["obligations:view"] });
    const localView = await listObligations(agentA, {});
    expect(localView.every((o) => o.arrondissementId === arrA)).toBe(true);
  });

  it("Test 15 — detecte qu'un agent n'est pas affecte a une zone donnee (base du controle anti-fraude)", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["collectors:create", "collectors:assign"] });
    const linkedUser = await createTestUser({ arrondissementIds: [arrA], permissions: [] });
    const agent = await createCollector(admin, { userId: linkedUser.id, arrondissementId: arrA });

    expect(await isAgentAssignedToZone(agent.id, quartierA)).toBe(false);

    await assignZone(admin, { agentId: agent.id, zoneType: "QUARTIER", quartierId: quartierA });
    expect(await isAgentAssignedToZone(agent.id, quartierA)).toBe(true);
  });

  it("une nouvelle affectation cloture l'ancienne (historisation) sans jamais la supprimer", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["collectors:create", "collectors:assign"] });
    const linkedUser = await createTestUser({ arrondissementIds: [arrA], permissions: [] });
    const agent = await createCollector(admin, { userId: linkedUser.id, arrondissementId: arrA });
    const quartierA2 = (await testPrisma.quartier.create({ data: { arrondissementId: arrA, name: uid("Quartier"), code: uid("Q") } })).id;

    const first = await assignZone(admin, { agentId: agent.id, zoneType: "QUARTIER", quartierId: quartierA });
    await assignZone(admin, { agentId: agent.id, zoneType: "QUARTIER", quartierId: quartierA2 });

    const firstReloaded = await testPrisma.agentAffectation.findUniqueOrThrow({ where: { id: first.id } });
    expect(firstReloaded.isActive).toBe(false);
    expect(firstReloaded.endDate).not.toBeNull();

    const activeCount = await testPrisma.agentAffectation.count({ where: { agentId: agent.id, isActive: true } });
    expect(activeCount).toBe(1);
  });
});
