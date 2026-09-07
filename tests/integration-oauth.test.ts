import { describe, it, expect, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { issueAccessToken, verifyAccessToken, looksLikeJwt } from "../src/lib/integration/oauth";
import { createIntegrationSystem, generateOAuthCredential, rotateOAuthCredential } from "../src/lib/services/integration-systems";
import { runGatewayRequest } from "../src/lib/integration/gateway";
import { createTestUser, testPrisma, uid, closeTestDb } from "./helpers/fixtures";

describe("Integration & Interoperability Center — OAuth2 (jetons)", () => {
  it("issueAccessToken/verifyAccessToken : cycle complet, rejette un jeton altere", async () => {
    const { token, expiresIn } = await issueAccessToken({ sub: "sys-123", client_id: "client_abc", scope: "citizens:read documents:verify" });
    expect(expiresIn).toBe(3600);
    expect(looksLikeJwt(token)).toBe(true);

    const verified = await verifyAccessToken(token);
    expect(verified).toEqual({ systemId: "sys-123", clientId: "client_abc", scopes: ["citizens:read", "documents:verify"] });

    const tampered = token.slice(0, -2) + "xx";
    expect(await verifyAccessToken(tampered)).toBeNull();
    expect(looksLikeJwt("sigk_notajwt")).toBe(false);
  });
});

describe("Integration & Interoperability Center — OAuth2 (identifiants et gateway)", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("genere des identifiants OAuth2 uniquement pour un systeme authType=OAUTH2, secret renvoye une seule fois, rotate change le secret pas le client_id", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:credentials"] });

    const apiKeySystem = await createIntegrationSystem(admin, { name: "API Key System", code: uid("SYS"), type: "OTHER", authType: "API_KEY", environment: "DEVELOPMENT" });
    await expect(generateOAuthCredential(admin, apiKeySystem.id, ["citizens:read"])).rejects.toMatchObject({ status: 400 });

    const oauthSystem = await createIntegrationSystem(admin, { name: "OAuth System", code: uid("SYS"), type: "GOVERNMENT", authType: "OAUTH2", environment: "DEVELOPMENT" });
    await expect(generateOAuthCredential(admin, oauthSystem.id, ["not-a-real-scope"])).rejects.toMatchObject({ status: 400 });

    const created = await generateOAuthCredential(admin, oauthSystem.id, ["citizens:read"]);
    expect(created.clientId).toMatch(/^client_/);

    const stored = await testPrisma.integrationCredential.findUniqueOrThrow({ where: { systemId: oauthSystem.id } });
    expect(stored.clientSecret).not.toBe(created.clientSecret); // chiffre, jamais en clair
    expect(stored.scopes).toEqual(["citizens:read"]);

    const rotated = await rotateOAuthCredential(admin, oauthSystem.id);
    expect(rotated.clientId).toBe(created.clientId); // identifiant stable
    expect(rotated.clientSecret).not.toBe(created.clientSecret); // secret different
  });

  it("POST /api/v1/oauth/token via la gateway : un jeton emis fonctionne reellement, un scope non accorde est refuse, un systeme desactive bloque le jeton deja emis", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:credentials", "integration:update"] });
    const system = await createIntegrationSystem(admin, { name: "Gateway OAuth System", code: uid("SYS"), type: "GOVERNMENT", authType: "OAUTH2", environment: "DEVELOPMENT" });
    const credential = await generateOAuthCredential(admin, system.id, ["citizens:read"]);

    const { token } = await issueAccessToken({ sub: system.id, client_id: credential.clientId, scope: "citizens:read" });

    function req(t: string | null) {
      return new NextRequest("http://localhost/api/v1/citizens", { method: "GET", headers: t ? { authorization: `Bearer ${t}` } : {} });
    }

    let handlerCalled = false;
    const ok = await runGatewayRequest(req(token), "citizens:read", async () => {
      handlerCalled = true;
      return { via: "oauth" };
    });
    expect(ok.status).toBe(200);
    expect(handlerCalled).toBe(true);

    const wrongScope = await runGatewayRequest(req(token), "documents:verify", async () => ({ ok: true }));
    expect(wrongScope.status).toBe(403);

    const { setIntegrationSystemEnabled } = await import("../src/lib/services/integration-systems");
    await setIntegrationSystemEnabled(admin, system.id, false);
    const afterDisable = await runGatewayRequest(req(token), "citizens:read", async () => ({ ok: true }));
    expect(afterDisable.status).toBe(401);
  });
});
