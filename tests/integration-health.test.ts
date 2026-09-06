import { describe, it, expect, afterAll } from "vitest";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { createIntegrationSystem } from "../src/lib/services/integration-systems";
import { checkSystemHealth, runHealthCheckNow, listSystemsHealth, getSystemHealth } from "../src/lib/services/integration-health";
import { createTestUser, testPrisma, uid, closeTestDb } from "./helpers/fixtures";

describe("Integration & Interoperability Center — health monitoring", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("checkSystemHealth enregistre une verification reelle (succes et echec) et met a jour le statut du systeme", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:health"] });

    const server = createServer((_req, res) => res.end("ok"));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const system = await createIntegrationSystem(admin, {
      name: "Health Test System", code: uid("SYS"), type: "OTHER", authType: "NONE", environment: "DEVELOPMENT",
      baseUrl: `http://127.0.0.1:${port}`,
    });

    const result = await checkSystemHealth(system);
    server.close();
    expect(result?.ok).toBe(true);

    const checks = await testPrisma.integrationHealthCheck.count({ where: { systemId: system.id } });
    expect(checks).toBe(1);

    const updated = await testPrisma.integrationSystem.findUniqueOrThrow({ where: { id: system.id } });
    expect(updated.status).toBe("CONNECTED");
    expect(updated.lastTestOk).toBe(true);
  });

  it("une seule IntegrationError est creee au PASSAGE en panne, pas a chaque verification periodique en echec", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create"] });
    const system = await createIntegrationSystem(admin, {
      name: "Flaky System", code: uid("SYS"), type: "OTHER", authType: "NONE", environment: "DEVELOPMENT",
      baseUrl: "http://127.0.0.1:1",
    });

    let current = await testPrisma.integrationSystem.findUniqueOrThrow({ where: { id: system.id } });
    await checkSystemHealth(current); // 1ere panne : transition healthy(null) -> false, doit creer une erreur
    current = await testPrisma.integrationSystem.findUniqueOrThrow({ where: { id: system.id } });
    await checkSystemHealth(current); // deja en panne : aucune nouvelle erreur
    current = await testPrisma.integrationSystem.findUniqueOrThrow({ where: { id: system.id } });
    await checkSystemHealth(current); // toujours en panne : aucune nouvelle erreur

    const errorCount = await testPrisma.integrationError.count({ where: { systemId: system.id, errorType: "HEALTH_CHECK_FAILED" } });
    expect(errorCount).toBe(1);

    const checkCount = await testPrisma.integrationHealthCheck.count({ where: { systemId: system.id } });
    expect(checkCount).toBe(3); // chaque verification est bien journalisee, meme sans nouvelle erreur
  });

  it("listSystemsHealth calcule un taux de disponibilite et un niveau coherents", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:health"] });
    const system = await createIntegrationSystem(admin, {
      name: "Mixed Health System", code: uid("SYS"), type: "OTHER", authType: "NONE", environment: "DEVELOPMENT",
      baseUrl: "http://127.0.0.1:1",
    });

    // Un seul echec enregistre -> uptime 0%, niveau OFFLINE.
    const current = await testPrisma.integrationSystem.findUniqueOrThrow({ where: { id: system.id } });
    await checkSystemHealth(current);

    const { health } = await getSystemHealth(admin, system.id);
    expect(health.uptimePct).toBe(0);
    expect(health.level).toBe("OFFLINE");
    expect(health.lastFailure).not.toBeNull();
    expect(health.lastSuccess).toBeNull();

    const all = await listSystemsHealth(admin);
    const entry = all.find((s) => s.system.id === system.id);
    expect(entry?.health.level).toBe("OFFLINE");
  });

  it("runHealthCheckNow refuse sans permission integration:health, refuse si aucune URL de base", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:health"] });
    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create"] });

    const noUrlSystem = await createIntegrationSystem(admin, { name: "No URL", code: uid("SYS"), type: "OTHER", authType: "NONE", environment: "DEVELOPMENT" });
    await expect(runHealthCheckNow(admin, noUrlSystem.id)).rejects.toMatchObject({ status: 400 });

    const system = await createIntegrationSystem(admin, { name: "With URL", code: uid("SYS"), type: "OTHER", authType: "NONE", environment: "DEVELOPMENT", baseUrl: "http://127.0.0.1:1" });
    await expect(runHealthCheckNow(noPerm, system.id)).rejects.toMatchObject({ status: 403 });

    const { result } = await runHealthCheckNow(admin, system.id);
    expect(result?.ok).toBe(false);
  });
});
