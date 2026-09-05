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
    // Acteurs distincts (separation des taches, module securite section 5) :
    // le declarant ne peut plus valider son propre dossier.
    const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["deaths:create"] });
    const validator = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["deaths:validate"] });
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

    await expect(validateDeathRecord(agent, record.id)).rejects.toMatchObject({ status: 403 });
    await validateDeathRecord(validator, record.id);

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

  // Module securite, section 8 : detection de doublon d'etat civil — jamais
  // bloquante. createTestCitizen() ne permet pas de fixer dateOfBirth (le
  // detecteur l'exige pour comparer deux fiches distinctes), d'ou la
  // creation directe ici plutot que via le helper.
  it("signale un doublon suspecte quand un homonyme (meme nom/prenom/date de naissance) est deja marque decede", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["deaths:create"] });
    const dateOfBirth = new Date("1980-01-01");
    await testPrisma.citizen.create({
      data: { uniqueNumber: `CIT-${Date.now()}-A`, firstName: "Homonyme", lastName: "Decede", sex: "M", dateOfBirth, arrondissementId, isDeceased: true },
    });
    const secondCitizen = await testPrisma.citizen.create({
      data: { uniqueNumber: `CIT-${Date.now()}-B`, firstName: "Homonyme", lastName: "Decede", sex: "M", dateOfBirth, arrondissementId },
    });

    const before = await testPrisma.fraudAlert.count({ where: { type: "DUPLICATE_DEATH_SUSPECTED" } });
    await declareDeath(agent, {
      deceasedId: secondCitizen.id,
      dateOfDeath: "2026-05-12",
      placeOfDeath: "Domicile",
      declarantName: "Declarant",
      arrondissementId,
    });
    const after = await testPrisma.fraudAlert.count({ where: { type: "DUPLICATE_DEATH_SUSPECTED" } });

    expect(after - before).toBe(1);
  });
});
