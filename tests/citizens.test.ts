import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createCitizen } from "../src/lib/services/citizens";
import { ApiError } from "../src/lib/api";
import {
  createTestCity,
  createTestArrondissement,
  createTestUser,
  closeTestDb,
} from "./helpers/fixtures";

describe("citizens service — creation critique (section 38)", () => {
  let arrondissementId: string;
  let otherArrondissementId: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrondissementId = (await createTestArrondissement(city.id, 1)).id;
    otherArrondissementId = (await createTestArrondissement(city.id, 2)).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("cree un citoyen avec un numero unique quand l'acteur a la permission et le perimetre requis", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["citizens:create"] });

    const citizen = await createCitizen(agent, {
      firstName: "Amina",
      lastName: "Hassan",
      sex: "F",
      arrondissementId,
    });

    expect(citizen.uniqueNumber).toMatch(/^CIT-\d{4}-[A-F0-9]{8}$/);
    expect(citizen.firstName).toBe("Amina");
    expect(citizen.arrondissementId).toBe(arrondissementId);
  });

  it("rejette la creation sans la permission citizens:create (cas d'erreur)", async () => {
    const agentSansPermission = await createTestUser({ arrondissementIds: [arrondissementId], permissions: [] });

    await expect(
      createCitizen(agentSansPermission, { firstName: "X", lastName: "Y", sex: "M", arrondissementId }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejette la creation hors du perimetre de l'agent — isolation territoriale (section 19/38)", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["citizens:create"] });

    await expect(
      createCitizen(agent, { firstName: "X", lastName: "Y", sex: "M", arrondissementId: otherArrondissementId }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejette un sexe invalide (validation serveur, cas d'erreur)", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["citizens:create"] });

    await expect(
      createCitizen(agent, { firstName: "X", lastName: "Y", sex: "AUTRE", arrondissementId }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejette un nom/prenom manquant (validation serveur, cas d'erreur)", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["citizens:create"] });

    await expect(
      createCitizen(agent, { firstName: "", lastName: "Y", sex: "M", arrondissementId }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("un compte Mairie Centrale peut creer un citoyen dans n'importe quel arrondissement", async () => {
    const central = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["citizens:create"] });

    const citizen = await createCitizen(central, {
      firstName: "Central",
      lastName: "Agent",
      sex: "M",
      arrondissementId: otherArrondissementId,
    });

    expect(citizen.arrondissementId).toBe(otherArrondissementId);
  });
});
