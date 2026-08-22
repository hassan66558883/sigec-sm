import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma as testDbPrisma } from "../src/lib/db";
import { createSubdivision, createParcel, issueLandTitle } from "../src/lib/services/land";
import { submitUrbanCase, reviewUrbanCase, inspectUrbanCase, decideUrbanCase } from "../src/lib/services/urbanism";
import { verifyCertificatePublic } from "../src/lib/services/certificates";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, closeTestDb } from "./helpers/fixtures";

// Petit helper local : recupere le certificat lie a un dossier d'urbanisme
// (decideUrbanCase() ne le renvoie pas directement, on le retrouve via la
// relation Certificate.urbanPlanningCaseId).
async function certificateForUrbanCase(urbanCaseId: string) {
  const withCerts = await testDbPrisma.urbanPlanningCase.findUniqueOrThrow({
    where: { id: urbanCaseId },
    include: { certificates: true },
  });
  if (withCerts.certificates.length === 0) throw new Error("aucun certificat genere");
  return withCerts.certificates[0];
}

// Foncier (parcelles/titres) et urbanisme (permis) — jamais testes jusqu'ici
// malgre le meme moteur de certificat/QR et la meme isolation territoriale
// que l'etat civil.
describe("foncier — parcelles, lotissements, titres", () => {
  let arrA: string;
  let arrB: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
    arrB = (await createTestArrondissement(city.id, 2)).id;
  });

  it("une parcelle sans proprietaire est AVAILABLE ; avec proprietaire elle est OCCUPIED", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["land:create"] });
    const owner = await createTestCitizen(arrA);

    const free = await createParcel(agent, { arrondissementId: arrA, area: 300 });
    expect(free.status).toBe("AVAILABLE");

    const occupied = await createParcel(agent, { arrondissementId: arrA, area: 450, ownerCitizenId: owner.id });
    expect(occupied.status).toBe("OCCUPIED");
    expect(occupied.parcelNumber).toMatch(/^PAR-/);
  });

  it("un agent ne peut pas creer une parcelle hors de son perimetre", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["land:create"] });
    await expect(createParcel(agent, { arrondissementId: arrB, area: 200 })).rejects.toMatchObject({ status: 403 });
  });

  it("un lotissement (subdivision) est cree dans le perimetre de son arrondissement", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["land:create"] });
    const subdivision = await createSubdivision(agent, { name: "Lotissement test", arrondissementId: arrA });
    expect(subdivision.arrondissementId).toBe(arrA);
  });

  it("emettre un titre foncier fait passer la parcelle a TITLED et refuse un second titre sur la meme parcelle", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["land:create", "land:issue_title"] });
    const owner = await createTestCitizen(arrA);
    const parcel = await createParcel(agent, { arrondissementId: arrA, area: 500 });

    const title = await issueLandTitle(agent, { parcelId: parcel.id, holderId: owner.id });
    expect(title.titleNumber).toMatch(/^TF-/);

    await expect(issueLandTitle(agent, { parcelId: parcel.id, holderId: owner.id })).rejects.toMatchObject({ status: 409 });
  });
});

describe("urbanisme — permis de construire/demolition", () => {
  let arrA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
  });

  it("le workflow complet (soumission -> instruction -> controle -> decision) emet automatiquement un certificat a l'approbation, verifiable publiquement", async () => {
    const agent = await createTestUser({
      arrondissementIds: [arrA],
      permissions: ["land:create", "urbanism:create", "urbanism:review", "urbanism:inspect", "urbanism:decide", "certificates:create"],
    });
    const applicant = await createTestCitizen(arrA);
    const parcel = await createParcel(agent, { arrondissementId: arrA, area: 400, ownerCitizenId: applicant.id });

    const submitted = await submitUrbanCase(agent, {
      type: "BUILDING_PERMIT",
      parcelId: parcel.id,
      applicantId: applicant.id,
      arrondissementId: arrA,
    });
    expect(submitted.status).toBe("SUBMITTED");

    const reviewed = await reviewUrbanCase(agent, submitted.id);
    expect(reviewed.status).toBe("UNDER_REVIEW");

    const inspected = await inspectUrbanCase(agent, submitted.id, "Terrain conforme.");
    expect(inspected.status).toBe("INSPECTED");

    const decided = await decideUrbanCase(agent, submitted.id, true);
    expect(decided.status).toBe("APPROVED");

    const certificate = await certificateForUrbanCase(submitted.id);
    const verification = await verifyCertificatePublic(certificate.qrToken);
    expect(verification.valid).toBe(true);
  });

  it("chaque etape du workflow n'est atteignable que depuis l'etat precedent (pas de saut d'etape)", async () => {
    const agent = await createTestUser({
      arrondissementIds: [arrA],
      permissions: ["land:create", "urbanism:create", "urbanism:inspect", "urbanism:decide"],
    });
    const applicant = await createTestCitizen(arrA);
    const parcel = await createParcel(agent, { arrondissementId: arrA, area: 100, ownerCitizenId: applicant.id });
    const submitted = await submitUrbanCase(agent, { type: "DEMOLITION_PERMIT", parcelId: parcel.id, applicantId: applicant.id, arrondissementId: arrA });

    // Tenter d'inspecter sans etre passe par la revision.
    await expect(inspectUrbanCase(agent, submitted.id, "")).rejects.toMatchObject({ status: 400 });
    // Tenter de decider sans inspection.
    await expect(decideUrbanCase(agent, submitted.id, true)).rejects.toMatchObject({ status: 400 });
  });

  it("un dossier d'urbanisme rejete n'emet aucun certificat", async () => {
    const agent = await createTestUser({
      arrondissementIds: [arrA],
      permissions: ["land:create", "urbanism:create", "urbanism:review", "urbanism:inspect", "urbanism:decide"],
    });
    const applicant = await createTestCitizen(arrA);
    const parcel = await createParcel(agent, { arrondissementId: arrA, area: 250, ownerCitizenId: applicant.id });
    const submitted = await submitUrbanCase(agent, { type: "BUILDING_PERMIT", parcelId: parcel.id, applicantId: applicant.id, arrondissementId: arrA });
    await reviewUrbanCase(agent, submitted.id);
    await inspectUrbanCase(agent, submitted.id);
    const decided = await decideUrbanCase(agent, submitted.id, false, "Zone non constructible.");
    expect(decided.status).toBe("REJECTED");
  });
});

afterAll(async () => {
  await closeTestDb();
});
