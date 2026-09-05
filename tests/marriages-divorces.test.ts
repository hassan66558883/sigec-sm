import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { declareMarriage, validateMarriage } from "../src/lib/services/marriages";
import { declareDivorce, validateDivorce } from "../src/lib/services/divorces";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, closeTestDb, testPrisma } from "./helpers/fixtures";

describe("mariage -> divorce : mise a jour de la situation matrimoniale (section 38)", () => {
  let arrondissementId: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrondissementId = (await createTestArrondissement(city.id, 1)).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("un mariage valide passe les deux epoux a MARRIED ; un divorce valide les repasse a DIVORCED", async () => {
    // Acteurs distincts pour declarer/valider (separation des taches,
    // module securite section 5) : depuis ce changement, le meme acteur ne
    // peut plus valider un dossier qu'il a lui-meme enregistre.
    const agent = await createTestUser({
      arrondissementIds: [arrondissementId],
      permissions: ["marriages:create", "divorces:create"],
    });
    const validator = await createTestUser({
      arrondissementIds: [arrondissementId],
      permissions: ["marriages:validate", "divorces:validate"],
    });

    const husband = await createTestCitizen(arrondissementId, { firstName: "Moussa", sex: "M" });
    const wife = await createTestCitizen(arrondissementId, { firstName: "Halima", sex: "F" });

    const marriage = await declareMarriage(agent, {
      husbandId: husband.id,
      wifeId: wife.id,
      marriageDate: "2026-04-01",
      marriagePlace: "Mairie centrale",
      arrondissementId,
    });
    expect(marriage.status).toBe("DECLARED");

    await expect(validateMarriage(agent, marriage.id)).rejects.toMatchObject({ status: 403 });
    await validateMarriage(validator, marriage.id);

    const husbandAfterMarriage = await testPrisma.citizen.findUniqueOrThrow({ where: { id: husband.id } });
    const wifeAfterMarriage = await testPrisma.citizen.findUniqueOrThrow({ where: { id: wife.id } });
    expect(husbandAfterMarriage.maritalStatus).toBe("MARRIED");
    expect(wifeAfterMarriage.maritalStatus).toBe("MARRIED");

    const divorce = await declareDivorce(agent, {
      marriageId: marriage.id,
      divorceDate: "2026-06-01",
      arrondissementId,
    });
    await validateDivorce(validator, divorce.id);

    const marriageAfterDivorce = await testPrisma.marriage.findUniqueOrThrow({ where: { id: marriage.id } });
    expect(marriageAfterDivorce.status).toBe("DIVORCED");

    const husbandAfterDivorce = await testPrisma.citizen.findUniqueOrThrow({ where: { id: husband.id } });
    const wifeAfterDivorce = await testPrisma.citizen.findUniqueOrThrow({ where: { id: wife.id } });
    expect(husbandAfterDivorce.maritalStatus).toBe("DIVORCED");
    expect(wifeAfterDivorce.maritalStatus).toBe("DIVORCED");
  });

  it("refuse un divorce sur un mariage qui n'est pas encore valide (cas d'erreur)", async () => {
    const agent = await createTestUser({
      arrondissementIds: [arrondissementId],
      permissions: ["marriages:create", "divorces:create"],
    });
    const husband = await createTestCitizen(arrondissementId, { sex: "M" });
    const wife = await createTestCitizen(arrondissementId, { sex: "F" });

    const marriage = await declareMarriage(agent, {
      husbandId: husband.id,
      wifeId: wife.id,
      marriageDate: "2026-04-01",
      marriagePlace: "Mairie centrale",
      arrondissementId,
    });

    await expect(
      declareDivorce(agent, { marriageId: marriage.id, divorceDate: "2026-05-01", arrondissementId }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("refuse un mariage avec le meme citoyen comme epoux et epouse (cas d'erreur)", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["marriages:create"] });
    const citizen = await createTestCitizen(arrondissementId);

    await expect(
      declareMarriage(agent, {
        husbandId: citizen.id,
        wifeId: citizen.id,
        marriageDate: "2026-04-01",
        marriagePlace: "Mairie centrale",
        arrondissementId,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  // Module securite, section 8 : detection de doublon d'etat civil — un
  // epoux deja engage dans un mariage ACTIF (jamais divorce) est signale,
  // jamais bloque (l'enregistrement d'etat civil reste souverain, la
  // detection sert seulement l'investigation humaine, ex. bigamie
  // suspectee ou simple erreur de saisie).
  it("signale un doublon suspecte quand un epoux figure deja dans un mariage actif (non divorce)", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["marriages:create"] });
    const husband = await createTestCitizen(arrondissementId, { sex: "M" });
    const firstWife = await createTestCitizen(arrondissementId, { sex: "F" });
    const secondWife = await createTestCitizen(arrondissementId, { sex: "F" });

    await declareMarriage(agent, { husbandId: husband.id, wifeId: firstWife.id, marriageDate: "2026-01-01", marriagePlace: "Mairie centrale", arrondissementId });

    const before = await testPrisma.fraudAlert.count({ where: { type: "DUPLICATE_MARRIAGE_SUSPECTED" } });
    await declareMarriage(agent, { husbandId: husband.id, wifeId: secondWife.id, marriageDate: "2026-08-01", marriagePlace: "Mairie centrale", arrondissementId });
    const after = await testPrisma.fraudAlert.count({ where: { type: "DUPLICATE_MARRIAGE_SUSPECTED" } });

    expect(after - before).toBe(1);
  });
});
