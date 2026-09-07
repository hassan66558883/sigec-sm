import { describe, it, expect, afterAll } from "vitest";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { createHmac } from "crypto";
import { createIntegrationSystem } from "../src/lib/services/integration-systems";
import { createSyncJob, runSyncJobNow, runDueSyncJobs, listSyncRuns, setSyncJobStatus } from "../src/lib/services/integration-sync";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, testPrisma, uid, closeTestDb } from "./helpers/fixtures";

describe("Integration & Interoperability Center — synchronization engine", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("cree une synchronisation, refuse SCHEDULED sans intervalMinutes, refuse un systeme sans URL de base, refuse sans permission", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:sync_manage"] });
    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create"] });

    const system = await createIntegrationSystem(admin, { name: "Sync Test System", code: uid("SYS"), type: "GOVERNMENT", authType: "NONE", environment: "DEVELOPMENT", baseUrl: "http://127.0.0.1:1" });

    await expect(createSyncJob(admin, { systemId: system.id, entityType: "CITIZENS", syncType: "SCHEDULED", endpointPath: "/sync" })).rejects.toMatchObject({ status: 400 });

    const noUrlSystem = await createIntegrationSystem(admin, { name: "No URL", code: uid("SYS"), type: "OTHER", authType: "NONE", environment: "DEVELOPMENT" });
    await expect(createSyncJob(admin, { systemId: noUrlSystem.id, entityType: "CITIZENS", syncType: "MANUAL", endpointPath: "/sync" })).rejects.toMatchObject({ status: 400 });

    await expect(createSyncJob(noPerm, { systemId: system.id, entityType: "CITIZENS", syncType: "MANUAL", endpointPath: "/sync" })).rejects.toMatchObject({ status: 403 });

    const created = await createSyncJob(admin, { systemId: system.id, entityType: "CITIZENS", syncType: "SCHEDULED", intervalMinutes: 30, endpointPath: "/sync/citizens" });
    expect(created.secret).toHaveLength(48);
    const job = await testPrisma.integrationSyncJob.findUniqueOrThrow({ where: { id: created.id } });
    expect(job.secret).not.toBe(created.secret); // chiffre, jamais en clair
    expect(job.nextSyncAt).not.toBeNull();
  });

  it("envoie reellement un lot signe a un recepteur local, avance lastSyncAt uniquement sur succes HTTP", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:sync_manage", "citizens:create"] });
    const city = await createTestCity();
    const arr = await createTestArrondissement(city.id, 1);
    await createTestCitizen(arr.id, { firstName: "Sync", lastName: "TestOne" });

    let receivedBody = "";
    let receivedSignature = "";
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        receivedBody = body;
        receivedSignature = req.headers["x-sigec-sync-signature"] as string;
        res.writeHead(200);
        res.end("ok");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const system = await createIntegrationSystem(admin, { name: "Receiver System", code: uid("SYS"), type: "GOVERNMENT", authType: "NONE", environment: "DEVELOPMENT", baseUrl: `http://127.0.0.1:${port}` });
    const created = await createSyncJob(admin, { systemId: system.id, entityType: "CITIZENS", syncType: "MANUAL", endpointPath: "/sync/citizens" });

    const result = await runSyncJobNow(admin, created.id);
    server.close();
    expect(result.ok).toBe(true);
    expect(result.sent).toBeGreaterThan(0);

    const expectedSecret = created.secret;
    const expectedSignature = createHmac("sha256", expectedSecret).update(receivedBody).digest("hex");
    expect(receivedSignature).toBe(expectedSignature);
    const parsed = JSON.parse(receivedBody);
    expect(parsed.entityType).toBe("CITIZENS");
    expect(Array.isArray(parsed.records)).toBe(true);

    const job = await testPrisma.integrationSyncJob.findUniqueOrThrow({ where: { id: created.id } });
    expect(job.lastSyncAt).not.toBeNull();

    const runs = await listSyncRuns(admin, created.id);
    expect(runs[0].status).toBe("SUCCESS");
    expect(runs[0].recordsSent).toBe(result.sent);
  });

  it("un echec HTTP ne fait PAS avancer lastSyncAt (le lot reste eligible au prochain essai), cree une IntegrationError", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:sync_manage", "citizens:create"] });
    const city = await createTestCity();
    const arr = await createTestArrondissement(city.id, 2);
    await createTestCitizen(arr.id, { firstName: "Sync", lastName: "TestFail" });

    const system = await createIntegrationSystem(admin, { name: "Unreachable Sync System", code: uid("SYS"), type: "GOVERNMENT", authType: "NONE", environment: "DEVELOPMENT", baseUrl: "http://127.0.0.1:1" });
    const created = await createSyncJob(admin, { systemId: system.id, entityType: "CITIZENS", syncType: "SCHEDULED", intervalMinutes: 30, endpointPath: "/sync/citizens" });

    const beforeJob = await testPrisma.integrationSyncJob.findUniqueOrThrow({ where: { id: created.id } });
    expect(beforeJob.lastSyncAt).toBeNull();

    const result = await runSyncJobNow(admin, created.id);
    expect(result.ok).toBe(false);

    const afterJob = await testPrisma.integrationSyncJob.findUniqueOrThrow({ where: { id: created.id } });
    expect(afterJob.lastSyncAt).toBeNull(); // toujours null : le lot en echec reste a reessayer
    expect(afterJob.nextSyncAt).not.toBeNull(); // mais l'echeance SCHEDULED avance quand meme

    const error = await testPrisma.integrationError.findFirst({ where: { systemId: system.id, errorType: "SYNC_FAILED" } });
    expect(error).not.toBeNull();

    const runs = await listSyncRuns(admin, created.id);
    expect(runs[0].status).toBe("FAILED");
    expect(runs[0].recordsFailed).toBeGreaterThan(0);
  });

  it("runDueSyncJobs ne traite que les jobs SCHEDULED actifs dont l'echeance est passee", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:sync_manage"] });
    const system = await createIntegrationSystem(admin, { name: "Due Test System", code: uid("SYS"), type: "GOVERNMENT", authType: "NONE", environment: "DEVELOPMENT", baseUrl: "http://127.0.0.1:1" });

    const notDue = await createSyncJob(admin, { systemId: system.id, entityType: "CITIZENS", syncType: "SCHEDULED", intervalMinutes: 999, endpointPath: "/a" });
    await testPrisma.integrationSyncJob.update({ where: { id: notDue.id }, data: { nextSyncAt: new Date(Date.now() + 999 * 60_000) } });

    const due = await createSyncJob(admin, { systemId: system.id, entityType: "CITIZENS", syncType: "SCHEDULED", intervalMinutes: 30, endpointPath: "/b" });
    await testPrisma.integrationSyncJob.update({ where: { id: due.id }, data: { nextSyncAt: new Date(Date.now() - 1000) } });

    const manual = await createSyncJob(admin, { systemId: system.id, entityType: "CITIZENS", syncType: "MANUAL", endpointPath: "/c" });

    const before = { notDue: (await testPrisma.integrationSyncRun.count({ where: { jobId: notDue.id } })), due: (await testPrisma.integrationSyncRun.count({ where: { jobId: due.id } })), manual: (await testPrisma.integrationSyncRun.count({ where: { jobId: manual.id } })) };

    await runDueSyncJobs();

    expect(await testPrisma.integrationSyncRun.count({ where: { jobId: notDue.id } })).toBe(before.notDue);
    expect(await testPrisma.integrationSyncRun.count({ where: { jobId: due.id } })).toBe(before.due + 1);
    expect(await testPrisma.integrationSyncRun.count({ where: { jobId: manual.id } })).toBe(before.manual);
  });

  it("desactiver un job l'exclut de runDueSyncJobs", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:sync_manage"] });
    const system = await createIntegrationSystem(admin, { name: "Disabled Sync System", code: uid("SYS"), type: "GOVERNMENT", authType: "NONE", environment: "DEVELOPMENT", baseUrl: "http://127.0.0.1:1" });
    const job = await createSyncJob(admin, { systemId: system.id, entityType: "CITIZENS", syncType: "SCHEDULED", intervalMinutes: 30, endpointPath: "/d" });
    await testPrisma.integrationSyncJob.update({ where: { id: job.id }, data: { nextSyncAt: new Date(Date.now() - 1000) } });
    await setSyncJobStatus(admin, job.id, "DISABLED");

    const before = await testPrisma.integrationSyncRun.count({ where: { jobId: job.id } });
    await runDueSyncJobs();
    expect(await testPrisma.integrationSyncRun.count({ where: { jobId: job.id } })).toBe(before);
  });
});
