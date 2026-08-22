import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPopulationStats, getCivilStatusStats, getServicesStats, getRecoveryStats, getArrondissementStatsReport } from "../src/lib/services/analytics";
import { sendSms } from "../src/lib/services/sms";
import { declareBirth } from "../src/lib/services/births";
import { createOrReviseTariff } from "../src/lib/services/tariffs";
import { createObligation } from "../src/lib/services/obligations";
import { recordPayment } from "../src/lib/services/payments";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, uid, closeTestDb } from "./helpers/fixtures";

describe("sms — stub honnete, aucun succes simule", () => {
  it("ne pretend jamais avoir envoye un message : sent est toujours false tant qu'aucun fournisseur n'est branche", async () => {
    const result = await sendSms("+23566000000", "Test");
    expect(result.sent).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("un numero manquant est rejete avec un motif explicite", async () => {
    const result = await sendSms("", "Test");
    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/manquant/i);
  });
});

describe("analytics — statistiques consolidees", () => {
  let arrA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("getPopulationStats compte correctement et ne renvoie la repartition par arrondissement qu'a la Mairie Centrale", async () => {
    await createTestCitizen(arrA, { sex: "M" });
    await createTestCitizen(arrA, { sex: "F" });

    const central = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });
    const statsCentral = await getPopulationStats(central);
    expect(statsCentral.total).toBeGreaterThanOrEqual(2);
    expect(statsCentral.arrondissementBreakdown.length).toBeGreaterThan(0);

    const scoped = await createTestUser({ arrondissementIds: [arrA], permissions: [] });
    const statsScoped = await getPopulationStats(scoped);
    expect(statsScoped.arrondissementBreakdown).toEqual([]);
  });

  it("getCivilStatusStats ne calcule (et n'expose) une section que si l'utilisateur a la permission de vue du module", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["births:create", "births:view"] });
    await declareBirth(agent, {
      childFirstName: "Test",
      childLastName: "Stats",
      childSex: "M",
      dateOfBirth: "2026-01-01",
      placeOfBirth: "Maternite",
      declarantName: "Declarant",
      arrondissementId: arrA,
    });

    const stats = await getCivilStatusStats(agent);
    expect(stats.births).not.toBeNull();
    expect(stats.births?.total).toBeGreaterThanOrEqual(1);
    expect(stats.marriages).toBeNull(); // pas de permission marriages:view

    const noPerm = await createTestUser({ arrondissementIds: [arrA], permissions: [] });
    const statsNoPerm = await getCivilStatusStats(noPerm);
    expect(statsNoPerm.births).toBeNull();
  });

  it("getServicesStats respecte la meme regle de visibilite par permission", async () => {
    const withLand = await createTestUser({ arrondissementIds: [arrA], permissions: ["land:view"] });
    const stats = await getServicesStats(withLand);
    expect(stats.parcels).not.toBeNull();
    expect(stats.complaints).toBeNull();
  });

  it("getRecoveryStats renvoie null sans les permissions requises, et calcule un taux de recouvrement correct", async () => {
    const noPerm = await createTestUser({ arrondissementIds: [arrA], permissions: [] });
    expect(await getRecoveryStats(noPerm)).toBeNull();

    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["tariffs:create", "obligations:create", "obligations:view", "payments:create", "payments:view"] });
    const owner = await createTestCitizen(arrA);
    const tarif = await createOrReviseTariff(agent, { code: uid("TARIF"), label: "Taxe", emplacementType: "BOUTIQUE", periodicity: "MENSUELLE", amount: 10000 });
    const obligation = await createObligation(agent, { citizenId: owner.id, tarifId: tarif.id, period: "2026-08", dueDate: "2026-08-31" });
    await recordPayment(agent, { payerId: owner.id, amount: 4000, paymentMethod: "ESPECES", obligationId: obligation.id });

    const stats = await getRecoveryStats(agent);
    expect(stats).not.toBeNull();
    expect(stats!.totalDue).toBeGreaterThanOrEqual(10000);
    expect(stats!.totalPaidOnObligations).toBeGreaterThanOrEqual(4000);
    expect(stats!.recoveryRate).toBeGreaterThan(0);
    expect(stats!.recoveryRate).toBeLessThanOrEqual(100);
  });

  it("getArrondissementStatsReport n'inclut une colonne que si l'utilisateur a la permission du module correspondant, et reste borne a son perimetre", async () => {
    const city = await createTestCity();
    const arrB = (await createTestArrondissement(city.id, 7)).id;
    await createTestCitizen(arrB);

    const fullAccess = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["citizens:view", "payments:view"] });
    const rows = await getArrondissementStatsReport(fullAccess);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => typeof r.population === "number")).toBe(true);
    expect(rows.every((r) => r.naissances === null)).toBe(true); // pas de births:view

    const scopedB = await createTestUser({ arrondissementIds: [arrB], permissions: ["citizens:view"] });
    const rowsScoped = await getArrondissementStatsReport(scopedB);
    expect(rowsScoped).toHaveLength(1);
  });
});
