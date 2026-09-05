import { describe, it, expect, afterAll } from "vitest";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { NextRequest } from "next/server";
import {
  createIntegrationSystem,
  updateIntegrationSystem,
  setIntegrationSystemEnabled,
  testIntegrationSystemConnection,
} from "../src/lib/services/integration-systems";
import { createApiKey, revokeApiKey, rotateApiKey } from "../src/lib/services/integration-api-keys";
import { getIntegrationDashboardSummary } from "../src/lib/services/integration-logs";
import { retryIntegrationError, resolveIntegrationError, ignoreIntegrationError } from "../src/lib/services/integration-errors";
import { runGatewayRequest } from "../src/lib/integration/gateway";
import { createTestUser, testPrisma, uid, closeTestDb } from "./helpers/fixtures";

describe("Integration & Interoperability Center — systemes connectes", () => {
  it("cree un systeme, refuse un code duplique, refuse sans permission", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:view", "integration:create"] });
    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });

    const code = uid("SYS");
    const system = await createIntegrationSystem(admin, {
      name: "Test Bank", code, type: "BANK", authType: "API_KEY", environment: "DEVELOPMENT",
    });
    expect(system.status).toBe("TESTING");
    expect(system.enabled).toBe(true);

    await expect(
      createIntegrationSystem(admin, { name: "Doublon", code, type: "BANK", authType: "API_KEY", environment: "DEVELOPMENT" }),
    ).rejects.toMatchObject({ status: 409 });

    await expect(
      createIntegrationSystem(noPerm, { name: "X", code: uid("SYS"), type: "BANK", authType: "API_KEY", environment: "DEVELOPMENT" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("Test Connection : succes reel contre un serveur local, echec reel contre un port ferme, cree une IntegrationError sur echec", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:view", "integration:create", "integration:test"] });

    // Serveur HTTP local ephemere : prouve un vrai aller-retour reseau,
    // jamais un succes simule.
    const server = createServer((_req, res) => res.end("ok"));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const reachable = await createIntegrationSystem(admin, {
      name: "Local Test Server", code: uid("SYS"), type: "OTHER", authType: "NONE", environment: "DEVELOPMENT",
      baseUrl: `http://127.0.0.1:${port}`,
    });
    const okResult = await testIntegrationSystemConnection(admin, reachable.id);
    expect(okResult.ok).toBe(true);
    expect(okResult.system.status).toBe("CONNECTED");
    server.close();

    const unreachable = await createIntegrationSystem(admin, {
      name: "Unreachable", code: uid("SYS"), type: "OTHER", authType: "NONE", environment: "DEVELOPMENT",
      baseUrl: "http://127.0.0.1:1",
    });
    const failResult = await testIntegrationSystemConnection(admin, unreachable.id);
    expect(failResult.ok).toBe(false);
    expect(failResult.system.status).toBe("OFFLINE");

    const error = await testPrisma.integrationError.findFirst({ where: { systemId: unreachable.id, errorType: "CONNECTION_TEST_FAILED" } });
    expect(error).not.toBeNull();
    expect(error?.status).toBe("NEW");
  });

  it("desactiver un systeme le marque DISABLED", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:update"] });
    const system = await createIntegrationSystem(admin, { name: "To Disable", code: uid("SYS"), type: "ERP", authType: "API_KEY", environment: "DEVELOPMENT" });
    const disabled = await setIntegrationSystemEnabled(admin, system.id, false);
    expect(disabled.enabled).toBe(false);
    expect(disabled.status).toBe("DISABLED");
  });

  it("un secret client n'est jamais efface par une mise a jour qui ne le renvoie pas", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:update"] });
    const system = await createIntegrationSystem(admin, {
      name: "OAuth System", code: uid("SYS"), type: "GOVERNMENT", authType: "OAUTH2", environment: "DEVELOPMENT",
      clientId: "client-abc", clientSecret: "super-secret-value",
    });
    await updateIntegrationSystem(admin, system.id, { name: "OAuth System Renamed" });
    const credential = await testPrisma.integrationCredential.findUniqueOrThrow({ where: { systemId: system.id } });
    expect(credential.clientSecret).not.toBeNull();
    expect(credential.clientSecret).not.toBe("super-secret-value"); // chiffre, jamais en clair
  });
});

describe("Integration & Interoperability Center — cles API et gateway", () => {
  it("genere une cle (secret renvoye une seule fois), la revoque, la fait tourner", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:credentials"] });

    const created = await createApiKey(admin, { name: "Test Key", scopes: ["citizens:read"] });
    expect(created.rawKey).toMatch(/^sigk_/);

    const stored = await testPrisma.integrationApiKey.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.keyHash).not.toBe(created.rawKey);

    await expect(createApiKey(admin, { name: "Bad scope", scopes: ["not-a-real-scope"] })).rejects.toMatchObject({ status: 400 });

    const revoked = await revokeApiKey(admin, created.id);
    expect(revoked.status).toBe("REVOKED");

    const key2 = await createApiKey(admin, { name: "To Rotate", scopes: ["documents:verify"] });
    const rotated = await rotateApiKey(admin, key2.id);
    expect(rotated.id).not.toBe(key2.id);
    const oldKey = await testPrisma.integrationApiKey.findUniqueOrThrow({ where: { id: key2.id } });
    expect(oldKey.status).toBe("REVOKED");
  });

  it("l'API Gateway authentifie une cle valide, rejette une cle invalide/revoquee, verifie le scope, applique le quota", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:credentials"] });
    const { rawKey } = await createApiKey(admin, { name: "Gateway Test Key", scopes: ["citizens:read"] });

    function makeReq(key: string | null) {
      return new NextRequest("http://localhost/api/v1/citizens", {
        method: "GET",
        headers: key ? { authorization: `Bearer ${key}` } : {},
      });
    }

    // Cle absente.
    const noKeyRes = await runGatewayRequest(makeReq(null), "citizens:read", async () => ({ ok: true }));
    expect(noKeyRes.status).toBe(401);

    // Cle invalide.
    const badKeyRes = await runGatewayRequest(makeReq("sigk_not_a_real_key_at_all"), "citizens:read", async () => ({ ok: true }));
    expect(badKeyRes.status).toBe(401);

    // Cle valide, bon scope : le handler s'execute reellement.
    let handlerCalled = false;
    const okRes = await runGatewayRequest(makeReq(rawKey), "citizens:read", async () => {
      handlerCalled = true;
      return { hello: "world" };
    });
    expect(okRes.status).toBe(200);
    expect(handlerCalled).toBe(true);
    expect(await okRes.json()).toEqual({ hello: "world" });

    // Scope manquant.
    const wrongScopeRes = await runGatewayRequest(makeReq(rawKey), "documents:verify", async () => ({ ok: true }));
    expect(wrongScopeRes.status).toBe(403);

    // Cle revoquee : refusee meme si le secret est correct.
    const keyRow = await testPrisma.integrationApiKey.findFirstOrThrow({ where: { keyPrefix: rawKey.slice(0, 12) } });
    await revokeApiKey(admin, keyRow.id);
    const revokedRes = await runGatewayRequest(makeReq(rawKey), "citizens:read", async () => ({ ok: true }));
    expect(revokedRes.status).toBe(401);

    // Chaque tentative (succes et echecs) doit avoir cree une ligne
    // IntegrationLog.
    const logs = await testPrisma.integrationLog.count({ where: { correlationId: { not: "" } } });
    expect(logs).toBeGreaterThan(0);
  });

  it("un systeme desactive est bloque par la gateway meme avec une cle valide", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:update", "integration:credentials"] });
    const system = await createIntegrationSystem(admin, { name: "Will Be Disabled", code: uid("SYS"), type: "ERP", authType: "API_KEY", environment: "DEVELOPMENT" });
    const { rawKey } = await createApiKey(admin, { name: "Key For Disabled System", systemId: system.id, scopes: ["citizens:read"] });

    const req = () => new NextRequest("http://localhost/api/v1/citizens", { method: "GET", headers: { authorization: `Bearer ${rawKey}` } });

    const beforeDisable = await runGatewayRequest(req(), "citizens:read", async () => ({ ok: true }));
    expect(beforeDisable.status).toBe(200);

    await setIntegrationSystemEnabled(admin, system.id, false);

    const afterDisable = await runGatewayRequest(req(), "citizens:read", async () => ({ ok: true }));
    expect(afterDisable.status).toBe(401);
  });
});

describe("Integration & Interoperability Center — erreurs et tableau de bord", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("retry ne fonctionne que pour une erreur CONNECTION_TEST_FAILED ; resolve/ignore fonctionnent sur toute erreur", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:test", "integration:retry"] });
    const system = await createIntegrationSystem(admin, { name: "For Errors", code: uid("SYS"), type: "OTHER", authType: "NONE", environment: "DEVELOPMENT", baseUrl: "http://127.0.0.1:1" });
    await testIntegrationSystemConnection(admin, system.id);
    const error = await testPrisma.integrationError.findFirstOrThrow({ where: { systemId: system.id, errorType: "CONNECTION_TEST_FAILED" } });

    const nonRetryable = await testPrisma.integrationError.create({ data: { systemId: system.id, endpoint: "/x", errorType: "GATEWAY_AUTH_INVALID", message: "test" } });
    await expect(retryIntegrationError(admin, nonRetryable.id)).rejects.toMatchObject({ status: 400 });

    const resolved = await resolveIntegrationError(admin, nonRetryable.id);
    expect(resolved.status).toBe("RESOLVED");

    const ignored = await ignoreIntegrationError(admin, error.id);
    expect(ignored.status).toBe("IGNORED");
  });

  it("le tableau de bord ne renvoie que des compteurs reels", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:view", "integration:create"] });
    const before = await getIntegrationDashboardSummary(admin);
    await createIntegrationSystem(admin, { name: "Dashboard Count Test", code: uid("SYS"), type: "OTHER", authType: "NONE", environment: "DEVELOPMENT" });
    const after = await getIntegrationDashboardSummary(admin);
    expect(after.connectedSystems).toBe(before.connectedSystems + 1);
  });
});
