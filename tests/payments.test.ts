import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { recordPayment, getFinanceSummary } from "../src/lib/services/payments";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, closeTestDb } from "./helpers/fixtures";

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
});
