import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createAssociation, setAssociationStatus } from "../src/lib/services/associations";
import {
  submitComplaint,
  listMyComplaints,
  listComplaintsForStaff,
  getComplaintForStaff,
  updateComplaintStatus,
  assignComplaint,
} from "../src/lib/services/complaints";
import { reportIssue, listMyReports, listInfrastructureForStaff, updateInfrastructureStatus } from "../src/lib/services/infrastructure";
import {
  createTestCity,
  createTestArrondissement,
  createTestUser,
  createTestCitizen,
  createTestCitizenAccount,
  closeTestDb,
} from "./helpers/fixtures";

describe("associations & ONG", () => {
  let arrA: string;
  let arrB: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
    arrB = (await createTestArrondissement(city.id, 2)).id;
  });

  it("cree une association avec numero d'enregistrement unique, dans le perimetre de l'agent", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["associations:create"] });
    const created = await createAssociation(agent, { name: "ONG Test", arrondissementId: arrA });
    expect(created.registrationNumber).toMatch(/^ASS-/);

    await expect(createAssociation(agent, { name: "ONG hors zone", arrondissementId: arrB })).rejects.toMatchObject({ status: 403 });
  });

  it("un statut invalide est rejete ; un statut valide (SUSPENDED/DISSOLVED) est applique", async () => {
    const agent = await createTestUser({ arrondissementIds: [arrA], permissions: ["associations:create", "associations:edit"] });
    const created = await createAssociation(agent, { name: "ONG Statut", arrondissementId: arrA });

    await expect(setAssociationStatus(agent, created.id, "AUTRE")).rejects.toMatchObject({ status: 400 });
    const suspended = await setAssociationStatus(agent, created.id, "SUSPENDED");
    expect(suspended.status).toBe("SUSPENDED");
  });
});

describe("plaintes citoyennes — guichet numerique", () => {
  let arrA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
  });

  it("un citoyen depose une plainte, categorie invalide rejetee, et la voit dans son historique avec l'update initial", async () => {
    const citizen = await createTestCitizen(arrA);
    const account = await createTestCitizenAccount(citizen.id);

    await expect(submitComplaint(account, { category: "INVALIDE", description: "test" })).rejects.toMatchObject({ status: 400 });

    const complaint = await submitComplaint(account, { category: "ECLAIRAGE", description: "Lampadaire casse rue principale." });
    expect(complaint.caseNumber).toMatch(/^PLT-/);
    expect(complaint.updates).toHaveLength(1);
    expect(complaint.updates[0].status).toBe("NEW");

    const mine = await listMyComplaints(account);
    expect(mine.map((c) => c.id)).toContain(complaint.id);
  });

  it("un agent affecte puis fait progresser une plainte ; chaque etape journalise un update ; l'isolation territoriale s'applique", async () => {
    const citizen = await createTestCitizen(arrA);
    const account = await createTestCitizenAccount(citizen.id);
    const complaint = await submitComplaint(account, { category: "VOIRIE", description: "Nid de poule." });

    const noPerm = await createTestUser({ arrondissementIds: [arrA], permissions: [] });
    await expect(listComplaintsForStaff(noPerm)).rejects.toMatchObject({ status: 403 });

    const staff = await createTestUser({ arrondissementIds: [arrA], permissions: ["complaints:view", "complaints:assign", "complaints:update"] });
    const assigned = await assignComplaint(staff, complaint.id, staff.id);
    expect(assigned.status).toBe("ASSIGNED");

    const resolved = await updateComplaintStatus(staff, complaint.id, "RESOLVED", "Reparation effectuee.");
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedAt).not.toBeNull();

    const detail = await getComplaintForStaff(staff, complaint.id);
    expect(detail.updates.length).toBeGreaterThanOrEqual(3); // NEW + ASSIGNED + RESOLVED

    const otherCity = await createTestCity();
    const arrOther = (await createTestArrondissement(otherCity.id, 5)).id;
    const outOfScope = await createTestUser({ arrondissementIds: [arrOther], permissions: ["complaints:view", "complaints:update"] });
    await expect(getComplaintForStaff(outOfScope, complaint.id)).rejects.toMatchObject({ status: 403 });
    await expect(updateComplaintStatus(outOfScope, complaint.id, "CLOSED")).rejects.toMatchObject({ status: 403 });
  });
});

describe("voirie & infrastructures — signalement citoyen", () => {
  let arrA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
  });

  it("un citoyen signale un probleme, type invalide rejete, et le retrouve dans ses signalements", async () => {
    const citizen = await createTestCitizen(arrA);
    const account = await createTestCitizenAccount(citizen.id);

    await expect(reportIssue(account, { type: "INVALIDE", description: "test" })).rejects.toMatchObject({ status: 400 });

    const report = await reportIssue(account, { type: "ROAD", description: "Route degradee." });
    expect(report.reportNumber).toMatch(/^VOI-/);

    const mine = await listMyReports(account);
    expect(mine.map((r) => r.id)).toContain(report.id);
  });

  it("un agent fait progresser le statut d'un signalement, horodate sa resolution ; hors perimetre = 403", async () => {
    const citizen = await createTestCitizen(arrA);
    const account = await createTestCitizenAccount(citizen.id);
    const report = await reportIssue(account, { type: "LIGHTING", description: "Eclairage public en panne." });

    const staff = await createTestUser({ arrondissementIds: [arrA], permissions: ["infrastructure:view", "infrastructure:update"] });
    const listed = await listInfrastructureForStaff(staff);
    expect(listed.map((r) => r.id)).toContain(report.id);

    const inProgress = await updateInfrastructureStatus(staff, report.id, "IN_PROGRESS");
    expect(inProgress.resolvedAt).toBeNull();
    const completed = await updateInfrastructureStatus(staff, report.id, "COMPLETED");
    expect(completed.resolvedAt).not.toBeNull();

    await expect(updateInfrastructureStatus(staff, report.id, "URGENCE")).rejects.toMatchObject({ status: 400 });

    const otherCity = await createTestCity();
    const arrOther = (await createTestArrondissement(otherCity.id, 5)).id;
    const outOfScope = await createTestUser({ arrondissementIds: [arrOther], permissions: ["infrastructure:update"] });
    await expect(updateInfrastructureStatus(outOfScope, report.id, "COMPLETED")).rejects.toMatchObject({ status: 403 });
  });
});

afterAll(async () => {
  await closeTestDb();
});
