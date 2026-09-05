import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { recordPayment, getFinanceSummary } from "../src/lib/services/payments";
import { createOrReviseTariff } from "../src/lib/services/tariffs";
import { createObligation } from "../src/lib/services/obligations";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, testPrisma, uid, closeTestDb } from "./helpers/fixtures";

// Section 38 ("paiements") + correction "recettes municipales" : les
// recettes doivent etre isolees par arrondissement, et un compte
// arrondissement ne doit jamais pouvoir enregistrer une recette centrale.
describe("paiements et recettes", () => {
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

  it("un agent d'arrondissement doit fournir un arrondissementId dans son propre perimetre", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["payments:create"] });
    const payer = await createTestCitizen(arrA);

    await expect(
      recordPayment(agent, { payerId: payer.id, amount: 1000, paymentMethod: "ESPECES", arrondissementId: null }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      recordPayment(agent, { payerId: payer.id, amount: 1000, paymentMethod: "ESPECES", arrondissementId: arrB }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("un agent d'arrondissement ne peut PAS enregistrer une recette Mairie Centrale (arrondissementId null)", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["payments:create"] });
    const payer = await createTestCitizen(arrA);

    await expect(
      recordPayment(agent, { payerId: payer.id, amount: 1000, paymentMethod: "ESPECES" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("un compte Mairie Centrale peut enregistrer une recette centrale (arrondissementId null)", async () => {
    const central = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["payments:create"] });
    const payer = await createTestCitizen(arrA);

    const payment = await recordPayment(central, { payerId: payer.id, amount: 75_000, paymentMethod: "VIREMENT" });
    expect(payment.arrondissementId).toBeNull();
    expect(payment.status).toBe("PAID");
  });

  it("rejette un montant invalide (cas d'erreur)", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["payments:create"] });
    const payer = await createTestCitizen(arrA);

    await expect(
      recordPayment(agent, { payerId: payer.id, amount: 0, paymentMethod: "ESPECES", arrondissementId: arrA }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      recordPayment(agent, { payerId: payer.id, amount: -500, paymentMethod: "ESPECES", arrondissementId: arrA }),
    ).rejects.toMatchObject({ status: 400 });
  });

  // Idempotence hors-ligne (module collecte hors ligne, section 22) : un
  // agent sans reseau met en file d'attente locale, puis rejoue apres
  // resynchronisation sans jamais savoir si le premier essai a reussi
  // cote serveur (reponse jamais recue). Verifie que le rejeu renvoie EXACTEMENT
  // le meme paiement, jamais un doublon, meme si l'obligation qu'il soldait
  // n'accepterait normalement plus de paiement (deja PAYE par ce meme paiement).
  it("clientRequestId rend recordPayment idempotent : un rejeu renvoie le paiement existant, jamais un doublon", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["payments:create"] });
    const payer = await createTestCitizen(arrA);
    const clientRequestId = `offline-${payer.id}-${Date.now()}`;

    const first = await recordPayment(agent, { payerId: payer.id, amount: 5000, paymentMethod: "ESPECES", arrondissementId: arrA, clientRequestId });
    const replay = await recordPayment(agent, { payerId: payer.id, amount: 5000, paymentMethod: "ESPECES", arrondissementId: arrA, clientRequestId });

    expect(replay.id).toBe(first.id);
    expect(replay.receipt?.id).toBe(first.receipt?.id);

    const count = await testPrisma.payment.count({ where: { payerId: payer.id, clientRequestId } });
    expect(count).toBe(1);
  });

  it("clientRequestId sur un paiement lie a une obligation : le rejeu renvoie le paiement original meme si l'obligation est deja soldee entre-temps", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["payments:create", "tariffs:create", "obligations:create"] });
    const payer = await createTestCitizen(arrA);
    const tarif = await createOrReviseTariff(admin, { code: uid("TARIF"), label: "Taxe test offline", emplacementType: "AUTRE", periodicity: "MENSUELLE", amount: 2000 });
    const obligation = await createObligation(admin, { citizenId: payer.id, tarifId: tarif.id, period: "2026-09", dueDate: "2026-09-30" });
    const clientRequestId = `offline-obl-${obligation.id}`;

    const first = await recordPayment(admin, { payerId: payer.id, amount: 2000, paymentMethod: "ESPECES", arrondissementId: arrA, obligationId: obligation.id, clientRequestId });
    expect(first.status).toBe("PAID");

    // Rejeu APRES que l'obligation soit deja PAYE (par ce meme paiement) —
    // sans idempotence, resolvePaymentContext() rejetterait ce rejeu avec
    // "obligation deja soldee", ce qui serait une erreur incorrecte pour un
    // simple rejeu de synchronisation d'un paiement qui a en realite reussi.
    const replay = await recordPayment(admin, { payerId: payer.id, amount: 2000, paymentMethod: "ESPECES", arrondissementId: arrA, obligationId: obligation.id, clientRequestId });
    expect(replay.id).toBe(first.id);

    const obligationAfter = await testPrisma.obligationPaiement.findUniqueOrThrow({ where: { id: obligation.id } });
    expect(obligationAfter.paidAmount).toBe(2000); // jamais credite deux fois
  });

  it("le total consolide de la Mairie Centrale = somme reelle (centrale + tous les arrondissements), jamais une valeur fixe", async () => {
    const central = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["payments:create", "payments:view"] });
    const agentA = await createTestUser({ arrondissementIds: [arrA], permissions: ["payments:create", "payments:view"] });
    const payer = await createTestCitizen(arrA);

    await recordPayment(central, { payerId: payer.id, amount: 10_000, paymentMethod: "ESPECES" });
    await recordPayment(agentA, { payerId: payer.id, amount: 25_000, paymentMethod: "ESPECES", arrondissementId: arrA });

    const centralSummary = await getFinanceSummary(central);
    const arrondissementNames = centralSummary.arrondissementBreakdown.map((r) => r.name);
    expect(arrondissementNames).toContain("Mairie Centrale");
    const total = centralSummary.arrondissementBreakdown.reduce((sum, r) => sum + r.total, 0);
    expect(centralSummary.total).toBe(total);
    expect(centralSummary.total).toBeGreaterThanOrEqual(35_000);
  });

  it("un agent d'arrondissement ne voit dans son resume que son propre perimetre, jamais la repartition globale", async () => {
    const agentB = await createTestUser({ arrondissementIds: [arrB], permissions: ["payments:create", "payments:view"] });
    const payer = await createTestCitizen(arrB);
    await recordPayment(agentB, { payerId: payer.id, amount: 5_000, paymentMethod: "ESPECES", arrondissementId: arrB });

    const summary = await getFinanceSummary(agentB);
    expect(summary.arrondissementBreakdown).toEqual([]); // pas de vision globale pour un compte local
    expect(summary.total).toBeGreaterThanOrEqual(5_000);
  });

  it("le decoupage jour/mois/annee inclut les recettes du jour et reste borne par le meme perimetre", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["payments:create", "payments:view"] });
    const payer = await createTestCitizen(arrA);
    await recordPayment(agent, { payerId: payer.id, amount: 12_000, paymentMethod: "ESPECES", arrondissementId: arrA });

    const summary = await getFinanceSummary(agent);
    expect(summary.byPeriod.today).toBeGreaterThanOrEqual(12_000);
    expect(summary.byPeriod.month).toBeGreaterThanOrEqual(summary.byPeriod.today);
    expect(summary.byPeriod.year).toBeGreaterThanOrEqual(summary.byPeriod.month);
  });
});
