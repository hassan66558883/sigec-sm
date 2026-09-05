import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApplication, approveApplication, rejectApplication, listApplicationsForStaff } from "../src/lib/services/applications";
import { registerCitizenAccount } from "../src/lib/services/citizen-portal";
import { declareBirth, validateBirthRecord } from "../src/lib/services/births";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizenAccount, uid, closeTestDb, testPrisma } from "./helpers/fixtures";

describe("demandes citoyennes — copies d'actes", () => {
  let arrA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
  });

  it("un citoyen ne peut demander une copie que d'un acte qui le concerne directement", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["births:create"] });
    const birth = await declareBirth(agent, {
      childFirstName: "Vrai",
      childLastName: "Titulaire",
      childSex: "F",
      dateOfBirth: "2026-01-01",
      placeOfBirth: "Maternite",
      declarantName: "Declarant",
      arrondissementId: arrA,
    });

    const otherAccount = await createTestCitizenAccount((await testPrisma.citizen.create({
      data: { uniqueNumber: uid("CIT"), firstName: "Autre", lastName: "Personne", sex: "M", arrondissementId: arrA },
    })).id);

    await expect(
      createApplication(otherAccount, { type: "BIRTH_CERTIFICATE_COPY", birthRecordId: birth.id }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("approuver une demande emet automatiquement le certificat et notifie le citoyen ; rejeter exige un motif", async () => {
    const agent = await createTestUser({
      arrondissementIds: [arrA],
      permissions: ["births:create", "certificates:create", "applications:view", "applications:approve", "applications:reject"],
    });
    // Separation des taches (module securite section 5) : un second acteur
    // valide le dossier, le declarant ne le pouvant plus lui-meme.
    const validator = await createTestUser({ arrondissementIds: [arrA], permissions: ["births:validate"] });
    const birth = await declareBirth(agent, {
      childFirstName: "Demandeur",
      childLastName: "Test",
      childSex: "M",
      dateOfBirth: "2026-01-01",
      placeOfBirth: "Maternite",
      declarantName: "Declarant",
      arrondissementId: arrA,
    });
    await validateBirthRecord(validator, birth.id);
    const account = await createTestCitizenAccount(birth.childId);

    const application = await createApplication(account, { type: "BIRTH_CERTIFICATE_COPY", birthRecordId: birth.id });
    expect(application.status).toBe("SUBMITTED");

    const approved = await approveApplication(agent, application.id);
    expect(approved.status).toBe("COMPLETED");
    expect(approved.resultCertificateId).not.toBeNull();

    const notification = await testPrisma.notification.findFirst({ where: { citizenAccountId: account.id, title: "Demande approuvee" } });
    expect(notification).not.toBeNull();

    // Une demande deja traitee ne peut pas etre traitee une seconde fois.
    await expect(approveApplication(agent, application.id)).rejects.toMatchObject({ status: 400 });

    const secondApplication = await createApplication(account, { type: "BIRTH_CERTIFICATE_COPY", birthRecordId: birth.id });
    await expect(rejectApplication(agent, secondApplication.id, "")).rejects.toMatchObject({ status: 400 });
    const rejected = await rejectApplication(agent, secondApplication.id, "Piece manquante.");
    expect(rejected.status).toBe("REJECTED");

    const staffView = await listApplicationsForStaff(agent);
    expect(staffView.map((a) => a.id)).toContain(application.id);
  });
});

describe("portail citoyen — creation de compte par rattachement", () => {
  let arrA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
  });

  it("refuse la creation d'un compte sans dossier citoyen preexistant correspondant exactement", async () => {
    await expect(
      registerCitizenAccount({ uniqueNumber: "CIT-INEXISTANT-0000", lastName: "Personne", email: `${uid("x")}@test.local`, password: "Password1234" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("un rattachement reussi cree le compte ; un second rattachement au meme dossier est refuse", async () => {
    // uniqueNumber cree explicitement en MAJUSCULES : registerCitizenAccount()
    // normalise l'entree utilisateur en majuscules avant la recherche, comme
    // le fait realement generateRecordNumber() en production (uid() du
    // fixture genere un hex minuscule, non representatif ici).
    const citizen = await testPrisma.citizen.create({
      data: { uniqueNumber: uid("CIT").toUpperCase(), firstName: "Prenom", lastName: "Nomdefamille", sex: "F", arrondissementId: arrA },
    });

    await expect(
      registerCitizenAccount({ uniqueNumber: citizen.uniqueNumber, lastName: "MauvaisNom", email: `${uid("x")}@test.local`, password: "Password1234" }),
    ).rejects.toMatchObject({ status: 404 });

    const account = await registerCitizenAccount({
      uniqueNumber: citizen.uniqueNumber,
      lastName: citizen.lastName,
      email: `${uid("citoyen")}@test.local`,
      password: "Password1234",
    });
    expect(account.citizenId).toBe(citizen.id);

    await expect(
      registerCitizenAccount({ uniqueNumber: citizen.uniqueNumber, lastName: citizen.lastName, email: `${uid("autre")}@test.local`, password: "Password1234" }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

afterAll(async () => {
  await closeTestDb();
});
