import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createMarket, createStall, setStallStatus, setMarketStatus, getMarket, getStall } from "../src/lib/services/markets";
import { createHousehold } from "../src/lib/services/households";
import { createActivity, setActivityActive, listActivities } from "../src/lib/services/activities";
import { declareRecognition, validateRecognition } from "../src/lib/services/recognitions";
import { declareBirth } from "../src/lib/services/births";
import { getMunicipalRevenueOverview } from "../src/lib/services/dashboard";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, uid, closeTestDb, testPrisma } from "./helpers/fixtures";

describe("marches & emplacements", () => {
  let arrA: string;
  let arrB: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
    arrB = (await createTestArrondissement(city.id, 2)).id;
  });

  it("cree un marche avec un code structure derive de l'arrondissement", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["markets:create"] });
    const market = await createMarket(agent, { name: "Grand Marche", arrondissementId: arrA });
    expect(market.code).toMatch(/^NDJ-A01-MKT-\d{6}$/);

    await expect(createMarket(agent, { name: "Hors zone", arrondissementId: arrB })).rejects.toMatchObject({ status: 403 });
  });

  it("un emplacement deja occupe ne peut pas etre reattribue a un autre contribuable sans etre libere d'abord", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["markets:create"] });
    const market = await createMarket(agent, { name: "Marche Test", arrondissementId: arrA });
    const stall = await createStall(agent, { marketId: market.id, code: uid("ETAL"), type: "ETAL" });

    const tenantA = await createTestCitizen(arrA);
    const tenantB = await createTestCitizen(arrA);

    const occupied = await setStallStatus(agent, stall.id, "OCCUPIED", tenantA.id);
    expect(occupied.occupantId).toBe(tenantA.id);

    // Reattribuer directement a un autre contribuable sans liberer d'abord
    // doit etre refuse (module paiement en ligne, section 4).
    await expect(setStallStatus(agent, stall.id, "OCCUPIED", tenantB.id)).rejects.toMatchObject({ status: 409 });

    // Liberer explicitement, puis reattribuer : autorise.
    await setStallStatus(agent, stall.id, "AVAILABLE");
    const reoccupied = await setStallStatus(agent, stall.id, "OCCUPIED", tenantB.id);
    expect(reoccupied.occupantId).toBe(tenantB.id);
  });

  it("reconfirmer le meme occupant (pas de changement reel) n'est pas bloque", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["markets:create"] });
    const market = await createMarket(agent, { name: "Marche Reconfirm", arrondissementId: arrA });
    const stall = await createStall(agent, { marketId: market.id, code: uid("ETAL") });
    const tenant = await createTestCitizen(arrA);

    await setStallStatus(agent, stall.id, "OCCUPIED", tenant.id);
    const again = await setStallStatus(agent, stall.id, "OCCUPIED", tenant.id);
    expect(again.occupantId).toBe(tenant.id);
  });

  it("un statut de marche invalide est rejete ; getMarket applique l'isolation territoriale", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["markets:create", "markets:edit"] });
    const market = await createMarket(agent, { name: "Marche Statut", arrondissementId: arrA });
    await expect(setMarketStatus(agent, market.id, "AUTRE")).rejects.toMatchObject({ status: 400 });

    const outOfScope = await createTestUser({ arrondissementIds: [arrB], permissions: [] });
    await expect(getMarket(outOfScope, market.id)).rejects.toMatchObject({ status: 403 });
  });

  it("getStall renvoie l'emplacement avec son marche/occupant et applique l'isolation territoriale", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["markets:create"] });
    const market = await createMarket(agent, { name: "Marche Detail", arrondissementId: arrA });
    const stall = await createStall(agent, { marketId: market.id, code: uid("ETAL") });
    const tenant = await createTestCitizen(arrA);
    await setStallStatus(agent, stall.id, "OCCUPIED", tenant.id);

    const fetched = await getStall(agent, stall.id);
    expect(fetched.market.id).toBe(market.id);
    expect(fetched.occupant?.id).toBe(tenant.id);

    const outOfScope = await createTestUser({ arrondissementIds: [arrB], permissions: [] });
    await expect(getStall(outOfScope, stall.id)).rejects.toMatchObject({ status: 403 });
    await expect(getStall(agent, "introuvable")).rejects.toMatchObject({ status: 404 });
  });
});

describe("menages", () => {
  it("cree un menage avec un code unique, rejette hors perimetre", async () => {
    const city = await createTestCity();
    const arrA = (await createTestArrondissement(city.id, 1)).id;
    const arrB = (await createTestArrondissement(city.id, 2)).id;
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["households:create"] });

    const household = await createHousehold(agent, { arrondissementId: arrA, address: "Rue test" });
    expect(household.code).toMatch(/^MEN-/);

    await expect(createHousehold(agent, { arrondissementId: arrB })).rejects.toMatchObject({ status: 403 });
  });
});

describe("referentiel activites economiques", () => {
  it("un code d'activite deja utilise est refuse ; la desactivation ne supprime jamais l'entree", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["tariffs:create", "tariffs:edit"] });
    const code = uid("ACT");
    const created = await createActivity(admin, { code, name: "Activite test" });
    await expect(createActivity(admin, { code, name: "Doublon" })).rejects.toMatchObject({ status: 409 });

    const deactivated = await setActivityActive(admin, created.id, false);
    expect(deactivated.isActive).toBe(false);
    const listed = await listActivities();
    expect(listed.map((a) => a.id)).toContain(created.id);
  });
});

describe("reconnaissances d'enfant", () => {
  let arrA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
  });

  it("valider une reconnaissance met a jour le lien parent sur le dossier de l'enfant, et refuse une seconde reconnaissance pour le meme enfant", async () => {
    // Acteurs distincts (separation des taches, module securite section 5) :
    // le declarant ne peut plus valider sa propre reconnaissance.
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["births:create", "recognitions:create"] });
    const validator = await createTestUser({ arrondissementIds: [arrA], permissions: ["recognitions:validate"] });
    const birth = await declareBirth(agent, {
      childFirstName: "Enfant",
      childLastName: "Test",
      childSex: "M",
      dateOfBirth: "2026-01-01",
      placeOfBirth: "Maternite",
      declarantName: "Declarant",
      arrondissementId: arrA,
    });
    const father = await createTestCitizen(arrA);

    const recognition = await declareRecognition(agent, { childId: birth.childId, parentId: father.id, parentRole: "FATHER", arrondissementId: arrA });
    expect(recognition.status).toBe("DECLARED");

    await expect(
      declareRecognition(agent, { childId: birth.childId, parentId: father.id, parentRole: "FATHER", arrondissementId: arrA }),
    ).rejects.toMatchObject({ status: 409 });

    await expect(validateRecognition(agent, recognition.id)).rejects.toMatchObject({ status: 403 });
    await validateRecognition(validator, recognition.id);
    const child = await testPrisma.citizen.findUniqueOrThrow({ where: { id: birth.childId } });
    expect(child.fatherId).toBe(father.id);
  });
});

describe("tableau de bord recettes — agregation dynamique", () => {
  it("ne renvoie que les compteurs du perimetre de l'utilisateur (jamais de valeur codee en dur)", async () => {
    const city = await createTestCity();
    const arrA = (await createTestArrondissement(city.id, 1)).id;
    const arrB = (await createTestArrondissement(city.id, 2)).id;
    const agentA = await createTestUser({ arrondissementIds: [arrA], permissions: [] });

    await createTestCitizen(arrA);
    await createTestCitizen(arrB);

    const overviewA = await getMunicipalRevenueOverview(agentA);
    expect(overviewA.citizens).toBe(1);
  });
});

afterAll(async () => {
  await closeTestDb();
});
