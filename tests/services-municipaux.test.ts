import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createAssociation, setAssociationStatus } from "../src/lib/services/associations";
import {
  submitComplaint,
  listMyComplaints,
  listComplaintsForStaff,
  listComplaintsForStaffPage,
  getComplaintForStaff,
  transitionComplaint,
  assignComplaintToDepartment,
  assignComplaintToAgent,
  requalifyComplaintPriority,
  escalateComplaint,
  getComplaintsDashboardStats,
} from "../src/lib/services/complaints";
import { reportIssue, listMyReports, listInfrastructureForStaff, updateInfrastructureStatus } from "../src/lib/services/infrastructure";
import {
  createTestCity,
  createTestArrondissement,
  createTestUser,
  createTestCitizen,
  createTestCitizenAccount,
  closeTestDb,
  testPrisma,
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
    expect(complaint.updates[0].status).toBe("SUBMITTED");

    const mine = await listMyComplaints(account);
    expect(mine.map((c) => c.id)).toContain(complaint.id);
  });

  it("un agent fait progresser une plainte a travers le workflow complet (13 etats) ; chaque etape journalise un update ; l'isolation territoriale et les transitions invalides sont refusees", async () => {
    const citizen = await createTestCitizen(arrA);
    const account = await createTestCitizenAccount(citizen.id);
    const complaint = await submitComplaint(account, { category: "VOIRIE", description: "Nid de poule." });

    const noPerm = await createTestUser({ arrondissementIds: [arrA], permissions: [] });
    await expect(listComplaintsForStaff(noPerm)).rejects.toMatchObject({ status: 403 });

    const staff = await createTestUser({
      arrondissementIds: [arrA],
      permissions: ["complaints:view", "complaints:assign", "complaints:update", "complaints:resolve"],
    });

    // Une transition incoherente (sauter des etapes) est refusee.
    await expect(transitionComplaint(staff, complaint.id, "RESOLVED")).rejects.toMatchObject({ status: 400 });

    const received = await transitionComplaint(staff, complaint.id, "RECEIVED");
    expect(received.status).toBe("RECEIVED");
    expect(received.receivedAt).not.toBeNull();

    const verifying = await transitionComplaint(staff, complaint.id, "VERIFYING");
    expect(verifying.status).toBe("VERIFYING");

    const department = await testPrisma.department.create({ data: { name: `Direction Technique ${complaint.id}`, code: `DT-${complaint.id}` } });
    const assignedDept = await assignComplaintToDepartment(staff, complaint.id, department.id);
    expect(assignedDept.status).toBe("ASSIGNED_DEPT");
    expect(assignedDept.assignedDepartmentId).toBe(department.id);

    const assignedAgent = await assignComplaintToAgent(staff, complaint.id, staff.id);
    expect(assignedAgent.status).toBe("ASSIGNED_AGENT");
    expect(assignedAgent.assignedToId).toBe(staff.id);
    expect(assignedAgent.dueAt).not.toBeNull();
    expect(assignedAgent.slaHours).toBe(240); // NORMAL = 10 jours = 240h

    const inProgress = await transitionComplaint(staff, complaint.id, "IN_PROGRESS");
    expect(inProgress.status).toBe("IN_PROGRESS");
    expect(inProgress.startedAt).not.toBeNull();

    const resolved = await transitionComplaint(staff, complaint.id, "RESOLVED", { resolutionNotes: "Reparation effectuee." });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedAt).not.toBeNull();

    const validating = await transitionComplaint(staff, complaint.id, "VALIDATING");
    expect(validating.status).toBe("VALIDATING");

    const closed = await transitionComplaint(staff, complaint.id, "CLOSED");
    expect(closed.status).toBe("CLOSED");
    expect(closed.closedAt).not.toBeNull();

    const detail = await getComplaintForStaff(staff, complaint.id);
    // SUBMITTED + RECEIVED + VERIFYING + ASSIGNED_DEPT + ASSIGNED_AGENT + IN_PROGRESS + RESOLVED + VALIDATING + CLOSED
    expect(detail.updates.length).toBeGreaterThanOrEqual(9);

    const otherCity = await createTestCity();
    const arrOther = (await createTestArrondissement(otherCity.id, 5)).id;
    const outOfScope = await createTestUser({ arrondissementIds: [arrOther], permissions: ["complaints:view", "complaints:update"] });
    await expect(getComplaintForStaff(outOfScope, complaint.id)).rejects.toMatchObject({ status: 403 });
  });

  it("le rejet d'une plainte exige un motif, et n'est autorise que depuis EN VERIFICATION", async () => {
    const citizen = await createTestCitizen(arrA);
    const account = await createTestCitizenAccount(citizen.id);
    const complaint = await submitComplaint(account, { category: "AUTRE", description: "Signalement test rejet." });
    const staff = await createTestUser({ arrondissementIds: [arrA], permissions: ["complaints:view", "complaints:update", "complaints:reject"] });

    // REJETE n'est pas atteignable depuis SOUMIS (seulement depuis EN VERIFICATION).
    await expect(transitionComplaint(staff, complaint.id, "REJECTED", { rejectionReason: "Hors competence." })).rejects.toMatchObject({ status: 400 });

    await transitionComplaint(staff, complaint.id, "RECEIVED");
    await transitionComplaint(staff, complaint.id, "VERIFYING");

    await expect(transitionComplaint(staff, complaint.id, "REJECTED")).rejects.toMatchObject({ status: 400 });

    const rejected = await transitionComplaint(staff, complaint.id, "REJECTED", { rejectionReason: "Hors competence municipale." });
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Hors competence municipale.");
  });

  it("l'escalade trace chaque saut de niveau independamment du statut, et refuse un niveau deja atteint", async () => {
    const citizen = await createTestCitizen(arrA);
    const account = await createTestCitizenAccount(citizen.id);
    const complaint = await submitComplaint(account, { category: "SECURITE", description: "Test escalade." });
    const staff = await createTestUser({ arrondissementIds: [arrA], permissions: ["complaints:view", "complaints:assign"] });

    await expect(escalateComplaint(staff, complaint.id, "INVALIDE")).rejects.toMatchObject({ status: 400 });

    const escalated = await escalateComplaint(staff, complaint.id, "SUPERVISOR", "Delai depasse.");
    expect(escalated.fromLevel).toBe("AGENT");
    expect(escalated.toLevel).toBe("SUPERVISOR");

    // Escalader vers le meme niveau que le niveau courant est refuse.
    await expect(escalateComplaint(staff, complaint.id, "SUPERVISOR")).rejects.toMatchObject({ status: 400 });

    const escalatedAgain = await escalateComplaint(staff, complaint.id, "DIRECTOR");
    expect(escalatedAgain.fromLevel).toBe("SUPERVISOR");
    expect(escalatedAgain.toLevel).toBe("DIRECTOR");
  });

  it("le tableau de bord agent (KPI) compte correctement nouvelles/urgentes/mes-plaintes, et la vue filtree ne renvoie que les dossiers correspondants", async () => {
    const citizen = await createTestCitizen(arrA);
    const account = await createTestCitizenAccount(citizen.id);
    const staff = await createTestUser({ arrondissementIds: [arrA], permissions: ["complaints:view", "complaints:assign", "complaints:update"] });

    const newOne = await submitComplaint(account, { category: "AUTRE", description: "Nouvelle plainte KPI." });
    const urgentOne = await submitComplaint(account, { category: "AUTRE", description: "Plainte urgente KPI." });
    await requalifyComplaintPriority(staff, urgentOne.id, "CRITIQUE");

    const statsBefore = await getComplaintsDashboardStats(staff);
    expect(statsBefore.new).toBeGreaterThanOrEqual(2);
    expect(statsBefore.urgent).toBeGreaterThanOrEqual(1);
    expect(statsBefore.mine).toBe(0); // rien n'est encore assigne a `staff`

    const { rows: newView } = await listComplaintsForStaffPage(staff, 1, 25, "new");
    expect(newView.every((c) => c.status === "SUBMITTED")).toBe(true);
    expect(newView.map((c) => c.id)).toEqual(expect.arrayContaining([newOne.id, urgentOne.id]));

    const { rows: urgentView } = await listComplaintsForStaffPage(staff, 1, 25, "urgent");
    expect(urgentView.map((c) => c.id)).toContain(urgentOne.id);
    expect(urgentView.map((c) => c.id)).not.toContain(newOne.id);
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
