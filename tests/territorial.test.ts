import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createArrondissement,
  setArrondissementActive,
  createQuartier,
  setQuartierActive,
  createSector,
  listSectors,
} from "../src/lib/services/territorial";
import { createTestCity, createTestArrondissement, createTestUser, uid, closeTestDb } from "./helpers/fixtures";

// Structure territoriale (fondation de tout le RBAC : recordScopeWhere/
// canAccessArrondissement) — jamais directement testee jusqu'ici malgre son
// role central. Couvre creation, activation/desactivation, et isolation.
describe("structure territoriale — arrondissements, quartiers, secteurs", () => {
  let cityId: string;
  let arrA: string;
  let arrB: string;

  beforeAll(async () => {
    const city = await createTestCity();
    cityId = city.id;
    arrA = (await createTestArrondissement(cityId, 1)).id;
    arrB = (await createTestArrondissement(cityId, 2)).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("seule une permission territorial:create autorise la creation d'un arrondissement", async () => {
    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });
    await expect(
      createArrondissement(noPerm, { cityId, number: 99, name: "Test", code: uid("ARR") }),
    ).rejects.toMatchObject({ status: 403 });

    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["territorial:create"] });
    const created = await createArrondissement(admin, { cityId, number: 42, name: "Nouvel arrondissement", code: uid("ARR") });
    expect(created.number).toBe(42);
  });

  it("un numero d'arrondissement invalide est rejete", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["territorial:create"] });
    await expect(
      createArrondissement(admin, { cityId, number: 0, name: "Invalide", code: uid("ARR") }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("un agent d'arrondissement ne peut pas desactiver un arrondissement hors de son perimetre", async () => {
    const scoped = await createTestUser({ arrondissementIds: [arrA], permissions: ["territorial:edit"] });
    await expect(setArrondissementActive(scoped, arrB, false)).rejects.toMatchObject({ status: 403 });

    const updated = await setArrondissementActive(scoped, arrA, false);
    expect(updated.isActive).toBe(false);
    await setArrondissementActive(scoped, arrA, true);
  });

  it("un quartier ne peut etre cree que par un agent ayant acces a son arrondissement", async () => {
    const scopedA = await createTestUser({ arrondissementIds: [arrA], permissions: ["territorial:create"] });
    const created = await createQuartier(scopedA, { arrondissementId: arrA, name: uid("Quartier"), code: uid("Q") });
    expect(created.arrondissementId).toBe(arrA);

    await expect(
      createQuartier(scopedA, { arrondissementId: arrB, name: uid("Quartier"), code: uid("Q") }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("un secteur herite l'isolation territoriale de son quartier (hors perimetre = 403)", async () => {
    const adminCentral = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["territorial:create"] });
    const quartierB = await createQuartier(adminCentral, { arrondissementId: arrB, name: uid("Quartier"), code: uid("Q") });

    const scopedA = await createTestUser({ arrondissementIds: [arrA], permissions: ["territorial:create"] });
    await expect(
      createSector(scopedA, { quartierId: quartierB.id, name: uid("Secteur"), code: uid("S") }),
    ).rejects.toMatchObject({ status: 403 });

    const scopedB = await createTestUser({ arrondissementIds: [arrB], permissions: ["territorial:create"] });
    const sector = await createSector(scopedB, { quartierId: quartierB.id, name: uid("Secteur"), code: uid("S") });
    const sectors = await listSectors(scopedB, quartierB.id);
    expect(sectors.map((s) => s.id)).toContain(sector.id);

    await expect(listSectors(scopedA, quartierB.id)).rejects.toMatchObject({ status: 403 });
  });

  it("desactiver un quartier ne le supprime jamais — seul isActive change", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["territorial:create", "territorial:edit"] });
    const quartier = await createQuartier(admin, { arrondissementId: arrA, name: uid("Quartier"), code: uid("Q") });
    const updated = await setQuartierActive(admin, quartier.id, false);
    expect(updated.id).toBe(quartier.id);
    expect(updated.isActive).toBe(false);
  });
});
