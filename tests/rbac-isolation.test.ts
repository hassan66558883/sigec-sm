import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { can, canAccessArrondissement, recordScopeWhere, arrondissementScopeWhere } from "../src/lib/rbac";
import { getCitizen } from "../src/lib/services/citizens";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, closeTestDb } from "./helpers/fixtures";

// Section 19/38 : isolation par arrondissement, appliquee cote backend et
// pas seulement masquee dans l'UI.
describe("RBAC et isolation territoriale", () => {
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

  it("can() reflete exactement les permissions accordees, rien de plus", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["births:view", "births:create"] });
    expect(can(agent, "births", "view")).toBe(true);
    expect(can(agent, "births", "create")).toBe(true);
    expect(can(agent, "births", "validate")).toBe(false);
    expect(can(agent, "citizens", "view")).toBe(false);
    expect(can(null, "births", "view")).toBe(false);
  });

  it("canAccessArrondissement : un agent local ne peut acceder qu'a son propre arrondissement", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: [] });
    expect(canAccessArrondissement(agent, arrA)).toBe(true);
    expect(canAccessArrondissement(agent, arrB)).toBe(false);
  });

  it("canAccessArrondissement : un compte Mairie Centrale accede a tous les arrondissements", async () => {
    const central = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });
    expect(canAccessArrondissement(central, arrA)).toBe(true);
    expect(canAccessArrondissement(central, arrB)).toBe(true);
  });

  it("recordScopeWhere restreint les requetes a l'arrondissement de l'agent, {} pour la Mairie Centrale", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: [] });
    const central = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });

    expect(recordScopeWhere(agent)).toEqual({ arrondissementId: { in: [arrA] } });
    expect(recordScopeWhere(central)).toEqual({});
    expect(recordScopeWhere(null)).toEqual({ arrondissementId: "__none__" });
  });

  it("arrondissementScopeWhere se comporte de la meme maniere pour la table Arrondissement elle-meme", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: [] });
    expect(arrondissementScopeWhere(agent)).toEqual({ id: { in: [arrA] } });
  });

  it("un agent ne peut PAS lire le dossier d'un citoyen hors de son perimetre — 403, pas de fuite de donnees", async () => {
    const citizenInB = await createTestCitizen(arrB);
    const agentOfA = await createTestUser({ arrondissementIds: [arrA], permissions: ["citizens:view"] });

    await expect(getCitizen(agentOfA, citizenInB.id)).rejects.toMatchObject({ status: 403 });
  });

  it("un agent PEUT lire un dossier de son propre arrondissement", async () => {
    const citizenInA = await createTestCitizen(arrA);
    const agentOfA = await createTestUser({ arrondissementIds: [arrA], permissions: ["citizens:view"] });

    const result = await getCitizen(agentOfA, citizenInA.id);
    expect(result.id).toBe(citizenInA.id);
  });

  it("un citoyen inexistant renvoie 404, pas une fuite d'information sur son existence potentielle", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["citizens:view"] });
    await expect(getCitizen(agent, "id-qui-nexiste-pas")).rejects.toMatchObject({ status: 404 });
  });
});
