import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { encryptField, decryptField } from "../src/lib/encryption";
import { declareDeath, listDeathRecords } from "../src/lib/services/deaths";
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

    afterAll(async () => {
      await closeTestDb();
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
});
