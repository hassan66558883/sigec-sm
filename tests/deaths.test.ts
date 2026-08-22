import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { declareDeath, validateDeathRecord } from "../src/lib/services/deaths";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, closeTestDb, testPrisma } from "./helpers/fixtures";

describe("deces : mise a jour du fichier de population (section 38)", () => {
  let arrondissementId: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrondissementId = (await createTestArrondissement(city.id, 1)).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("valider un deces marque le citoyen comme decede", async () => {
    const agent = await createTestUser({
      arrondissementIds: [arrondissementId],
      permissions: ["deaths:create", "deaths:validate"],
    });
    const citizen = await createTestCitizen(arrondissementId);
    expect(citizen.isDeceased).toBe(false);

    const record = await declareDeath(agent, {
      deceasedId: citizen.id,
      dateOfDeath: "2026-05-10",
      placeOfDeath: "Domicile",
      declarantName: "Fils du defunt",
      arrondissementId,
    });
    expect(record.status).toBe("DECLARED");

    await validateDeathRecord(agent, record.id);

    const updated = await testPrisma.citizen.findUniqueOrThrow({ where: { id: citizen.id } });
    expect(updated.isDeceased).toBe(true);
  });

  it("refuse un second acte de deces pour la meme personne (cas d'erreur, contrainte unique)", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["deaths:create"] });
    const citizen = await createTestCitizen(arrondissementId);

    await declareDeath(agent, {
      deceasedId: citizen.id,
      dateOfDeath: "2026-05-10",
      placeOfDeath: "Domicile",
      declarantName: "Declarant",
      arrondissementId,
    });

    await expect(
      declareDeath(agent, {
        deceasedId: citizen.id,
        dateOfDeath: "2026-05-11",
        placeOfDeath: "Domicile",
        declarantName: "Autre declarant",
        arrondissementId,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
