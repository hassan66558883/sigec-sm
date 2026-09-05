import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { declareBirth, validateBirthRecord, annulBirthRecord } from "../src/lib/services/births";
import { issueBirthCertificate, revokeCertificate, verifyCertificatePublic } from "../src/lib/services/certificates";
import { createTestCity, createTestArrondissement, createTestUser, closeTestDb, testPrisma } from "./helpers/fixtures";

// Couvre le cycle complet exige par la section 38 : naissance -> validation
// -> generation certificat -> verification QR -> revocation.
describe("cycle de vie complet — naissance -> certificat -> verification -> revocation", () => {
  let arrondissementId: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrondissementId = (await createTestArrondissement(city.id, 1)).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("refuse d'emettre un certificat avant l'enregistrement officiel de l'acte (workflow section 17)", async () => {
    const agent = await createTestUser({
      arrondissementIds: [arrondissementId],
      permissions: ["births:create", "certificates:create"],
    });

    const record = await declareBirth(agent, {
      childFirstName: "Fatime",
      childLastName: "Abakar",
      childSex: "F",
      dateOfBirth: "2026-01-10",
      placeOfBirth: "Hopital de la Liberte",
      declarantName: "Mere Abakar",
      arrondissementId,
    });

    expect(record.status).toBe("DECLARED");

    await expect(issueBirthCertificate(agent, record.id)).rejects.toMatchObject({ status: 400 });
  });

  it("cycle complet reussi : declarer -> valider -> emettre -> verifier publiquement -> revoquer", async () => {
    // Deux acteurs distincts pour la declaration et la validation
    // (separation des taches, module securite section 5) : la personne qui
    // enregistre une naissance ne peut plus, depuis ce changement, valider
    // elle-meme ce meme dossier, meme si son role cumule les deux
    // permissions.
    const agent = await createTestUser({
      arrondissementIds: [arrondissementId],
      permissions: ["births:create", "births:revoke", "certificates:create", "certificates:revoke"],
    });
    const validator = await createTestUser({
      arrondissementIds: [arrondissementId],
      permissions: ["births:validate"],
    });

    const record = await declareBirth(agent, {
      childFirstName: "Ismael",
      childLastName: "Ousmane",
      childSex: "M",
      dateOfBirth: "2026-02-14",
      placeOfBirth: "Maternite Centrale",
      declarantName: "Pere Ousmane",
      arrondissementId,
    });

    // Un dossier citoyen a bien ete cree pour l'enfant.
    const child = await testPrisma.citizen.findUnique({ where: { id: record.childId } });
    expect(child).not.toBeNull();
    expect(child?.uniqueNumber).toMatch(/^CIT-/);

    // Le declarant lui-meme ne peut pas valider son propre dossier.
    await expect(validateBirthRecord(agent, record.id)).rejects.toMatchObject({ status: 403 });

    const validated = await validateBirthRecord(validator, record.id);
    expect(validated.status).toBe("REGISTERED");
    expect(validated.registeredAt).not.toBeNull();

    // Re-valider un dossier deja enregistre doit echouer (transition invalide).
    await expect(validateBirthRecord(validator, record.id)).rejects.toMatchObject({ status: 400 });

    const certificate = await issueBirthCertificate(agent, record.id);
    expect(certificate.status).toBe("VALID");
    expect(certificate.qrToken).toHaveLength(32); // base64url de 24 octets

    // Verification publique : accessible sans authentification, ne doit
    // jamais exposer le nom du citoyen (section 16).
    const verification = await verifyCertificatePublic(certificate.qrToken);
    expect(verification.found).toBe(true);
    if (verification.found) {
      expect(verification.valid).toBe(true);
      expect(verification.status).toBe("VALID");
      expect(JSON.stringify(verification)).not.toContain("Ismael");
      expect(JSON.stringify(verification)).not.toContain("Ousmane");
    }

    // Revocation avec motif obligatoire.
    await expect(revokeCertificate(agent, certificate.id, "")).rejects.toMatchObject({ status: 400 });
    const revoked = await revokeCertificate(agent, certificate.id, "Erreur materielle sur le document");
    expect(revoked.status).toBe("REVOKED");

    const verificationAfterRevoke = await verifyCertificatePublic(certificate.qrToken);
    expect(verificationAfterRevoke.found).toBe(true);
    if (verificationAfterRevoke.found) {
      expect(verificationAfterRevoke.valid).toBe(false);
      expect(verificationAfterRevoke.status).toBe("REVOKED");
    }
  });

  it("verification d'un token inconnu renvoie found:false sans lever d'erreur", async () => {
    const result = await verifyCertificatePublic("un-token-qui-nexiste-pas");
    expect(result.found).toBe(false);
  });

  it("annulation d'un acte de naissance exige un motif et journalise l'action", async () => {
    const agent = await createTestUser({
      arrondissementIds: [arrondissementId],
      permissions: ["births:create", "births:revoke"],
    });

    const record = await declareBirth(agent, {
      childFirstName: "Test",
      childLastName: "Annulation",
      childSex: "M",
      dateOfBirth: "2026-03-01",
      placeOfBirth: "Domicile",
      declarantName: "Declarant",
      arrondissementId,
    });

    await expect(annulBirthRecord(agent, record.id, "")).rejects.toMatchObject({ status: 400 });

    const annulled = await annulBirthRecord(agent, record.id, "Erreur de saisie, doublon avec un autre dossier");
    expect(annulled.status).toBe("ANNULLED");

    const auditEntry = await testPrisma.auditLog.findFirst({
      where: { entityType: "BirthRecord", entityId: record.id, action: "REVOKE" },
      orderBy: { createdAt: "desc" },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry?.userId).toBe(agent.id);
  });

  // Module securite, section 8 : detection de doublon d'etat civil — jamais
  // bloquante (un homonyme reel existe), signale seulement pour
  // investigation humaine.
  it("signale un doublon suspecte quand un homonyme (meme nom/prenom/date de naissance) a deja un acte de naissance", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrondissementId], permissions: ["births:create"] });

    await declareBirth(agent, {
      childFirstName: "Doublon",
      childLastName: "Suspect",
      childSex: "M",
      dateOfBirth: "2026-07-01",
      placeOfBirth: "Maternite",
      declarantName: "Declarant Un",
      arrondissementId,
    });

    const before = await testPrisma.fraudAlert.count({ where: { type: "DUPLICATE_BIRTH_SUSPECTED" } });

    await declareBirth(agent, {
      childFirstName: "Doublon",
      childLastName: "Suspect",
      childSex: "M",
      dateOfBirth: "2026-07-01",
      placeOfBirth: "Autre lieu",
      declarantName: "Declarant Deux",
      arrondissementId,
    });

    const after = await testPrisma.fraudAlert.count({ where: { type: "DUPLICATE_BIRTH_SUSPECTED" } });
    expect(after - before).toBe(1);
  });
});
