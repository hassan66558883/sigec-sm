import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { encryptField, decryptField } from "../src/lib/encryption";
import { declareDeath, listDeathRecords } from "../src/lib/services/deaths";
import { createCitizen, updateCitizen, getCitizen, listCitizens } from "../src/lib/services/citizens";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, closeTestDb, testPrisma } from "./helpers/fixtures";

describe("chiffrement des champs sensibles (section 32)", () => {
  it("chiffre puis dechiffre une valeur sans perte", () => {
    const plaintext = "Arret cardiaque, cause naturelle";
    const stored = encryptField(plaintext);
    expect(stored).not.toBeNull();
    expect(stored).not.toContain(plaintext); // jamais de fuite en clair dans la valeur stockee
    expect(decryptField(stored)).toBe(plaintext);
  });

  it("renvoie null pour une entree vide/nulle, sans lever d'erreur", () => {
    expect(encryptField(undefined)).toBeNull();
    expect(encryptField(null)).toBeNull();
    expect(encryptField("")).toBeNull();
    expect(decryptField(null)).toBeNull();
  });

  it("deux chiffrements de la meme valeur produisent des sorties differentes (IV aleatoire)", () => {
    const a = encryptField("meme valeur");
    const b = encryptField("meme valeur");
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe("meme valeur");
    expect(decryptField(b)).toBe("meme valeur");
  });

  describe("integration avec DeathRecord.cause", () => {
    let arrondissementId: string;

    beforeAll(async () => {
      const city = await createTestCity();
      arrondissementId = (await createTestArrondissement(city.id, 1)).id;
    });

    it("la cause du deces est stockee chiffree en base et dechiffree a la lecture via le service", async () => {
      const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["deaths:create", "deaths:view"] });
      const citizen = await createTestCitizen(arrondissementId);
      const causeReelle = "Insuffisance respiratoire aigue";

      const record = await declareDeath(agent, {
        deceasedId: citizen.id,
        dateOfDeath: "2026-07-01",
        placeOfDeath: "Hopital",
        cause: causeReelle,
        declarantName: "Declarant",
        arrondissementId,
      });

      // Lecture brute (contournant le service) : la valeur en base ne doit
      // JAMAIS contenir le texte en clair.
      const raw = await testPrisma.deathRecord.findUniqueOrThrow({ where: { id: record.id } });
      expect(raw.cause).not.toBeNull();
      expect(raw.cause).not.toBe(causeReelle);
      expect(raw.cause).not.toContain(causeReelle);

      // Lecture via le service : dechiffrement transparent.
      const list = await listDeathRecords(agent);
      const found = list.find((r) => r.id === record.id);
      expect(found?.cause).toBe(causeReelle);
    });

    it("un acte sans cause renseignee reste null (champ optionnel, section 39)", async () => {
      const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["deaths:create", "deaths:view"] });
      const citizen = await createTestCitizen(arrondissementId);

      const record = await declareDeath(agent, {
        deceasedId: citizen.id,
        dateOfDeath: "2026-07-02",
        placeOfDeath: "Domicile",
        declarantName: "Declarant",
        arrondissementId,
      });

      const raw = await testPrisma.deathRecord.findUniqueOrThrow({ where: { id: record.id } });
      expect(raw.cause).toBeNull();
    });
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("integration avec Citizen.phone", () => {
    let arrondissementId: string;

    beforeAll(async () => {
      const city = await createTestCity();
      arrondissementId = (await createTestArrondissement(city.id, 1)).id;
    });

    it("le numero de telephone est stocke chiffre en base et dechiffre a la lecture via le service", async () => {
      const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["citizens:create", "citizens:view"] });
      const numeroReel = "+23566789012";

      const created = await createCitizen(agent, {
        firstName: "Test",
        lastName: "Chiffrement",
        sex: "M",
        phone: numeroReel,
        arrondissementId,
      });
      expect(created.phone).toBe(numeroReel); // le service renvoie deja le clair

      const raw = await testPrisma.citizen.findUniqueOrThrow({ where: { id: created.id } });
      expect(raw.phone).not.toBeNull();
      expect(raw.phone).not.toBe(numeroReel);
      expect(raw.phone).not.toContain(numeroReel);

      const fetched = await getCitizen(agent, created.id);
      expect(fetched.phone).toBe(numeroReel);

      const listed = await listCitizens(agent, created.uniqueNumber);
      expect(listed.find((c) => c.id === created.id)?.phone).toBe(numeroReel);
    });

    it("une mise a jour partielle qui n'inclut pas le telephone ne l'efface jamais", async () => {
      const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["citizens:create", "citizens:edit", "citizens:view"] });
      const numeroReel = "+23566000111";
      const created = await createCitizen(agent, { firstName: "Test", lastName: "Partiel", sex: "F", phone: numeroReel, arrondissementId });

      // Met a jour uniquement l'adresse — le champ phone n'est pas fourni.
      await updateCitizen(agent, created.id, { address: "Nouvelle adresse" });

      const fetched = await getCitizen(agent, created.id);
      expect(fetched.phone).toBe(numeroReel); // toujours present, jamais efface
      expect(fetched.address).toBe("Nouvelle adresse");
    });

    it("une mise a jour explicite du telephone le re-chiffre correctement", async () => {
      const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["citizens:create", "citizens:edit", "citizens:view"] });
      const created = await createCitizen(agent, { firstName: "Test", lastName: "Modif", sex: "M", phone: "+23566111222", arrondissementId });

      const nouveauNumero = "+23566333444";
      await updateCitizen(agent, created.id, { phone: nouveauNumero });

      const fetched = await getCitizen(agent, created.id);
      expect(fetched.phone).toBe(nouveauNumero);

      const raw = await testPrisma.citizen.findUniqueOrThrow({ where: { id: created.id } });
      expect(raw.phone).not.toBe(nouveauNumero);
    });
  });
});
