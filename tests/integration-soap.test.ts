import { describe, it, expect, afterAll } from "vitest";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import { parseSoapRequest, buildSoapSyncBatch } from "../src/lib/integration/soap";
import { POST as soapRoute } from "../src/app/api/v1/soap/route";
import { createApiKey } from "../src/lib/services/integration-api-keys";
import { createIntegrationSystem } from "../src/lib/services/integration-systems";
import { createSyncJob, runSyncJobNow } from "../src/lib/services/integration-sync";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, uid, closeTestDb } from "./helpers/fixtures";

describe("Integration & Interoperability Center — adaptateur SOAP/legacy — parseSoapRequest", () => {
  it("extrait l'operation et les parametres d'une enveloppe valide, quel que soit le prefixe d'espace de noms", () => {
    const envelope =
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
      "<soapenv:Body><GetCitizen><id>ABC-123</id></GetCitizen></soapenv:Body></soapenv:Envelope>";
    expect(parseSoapRequest(envelope)).toEqual({ operation: "GetCitizen", params: { id: "ABC-123" } });

    const otherPrefix =
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
      "<soap:Body><VerifyDocument><token>xyz</token></VerifyDocument></soap:Body></soap:Envelope>";
    expect(parseSoapRequest(otherPrefix)).toEqual({ operation: "VerifyDocument", params: { token: "xyz" } });

    const noPrefix = "<Envelope><Body><GetCitizen><id>NP-1</id></GetCitizen></Body></Envelope>";
    expect(parseSoapRequest(noPrefix)).toEqual({ operation: "GetCitizen", params: { id: "NP-1" } });
  });

  it("rejette un XML mal forme", () => {
    expect(() => parseSoapRequest("<soapenv:Envelope><soapenv:Body><Unclosed>")).toThrow(/mal forme/);
  });

  it("rejette une enveloppe sans Body", () => {
    const envelope = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"></soapenv:Envelope>';
    expect(() => parseSoapRequest(envelope)).toThrow(/Body introuvable/);
  });

  it("rejette un Body sans operation", () => {
    const envelope = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body></soapenv:Body></soapenv:Envelope>';
    expect(() => parseSoapRequest(envelope)).toThrow(/aucune operation/);
  });
});

describe("Integration & Interoperability Center — adaptateur SOAP/legacy — route /api/v1/soap", () => {
  function envelope(operation: string, params: Record<string, string>) {
    const inner = Object.entries(params).map(([k, v]) => `<${k}>${v}</${k}>`).join("");
    return `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><${operation}>${inner}</${operation}></soapenv:Body></soapenv:Envelope>`;
  }

  function makeReq(body: string, apiKey: string | null) {
    return new NextRequest("http://localhost/api/v1/soap", {
      method: "POST",
      headers: { "Content-Type": "text/xml", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
      body,
    });
  }

  it("GetCitizen : renvoie une reponse SOAP reelle pour un citoyen existant, un Fault pour un id absent ou introuvable", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:credentials", "citizens:create"] });
    const { rawKey } = await createApiKey(admin, { name: "SOAP Test Key", scopes: ["soap:legacy"] });
    const city = await createTestCity();
    const arr = await createTestArrondissement(city.id, 3);
    const citizen = await createTestCitizen(arr.id, { firstName: "SoapCitizen", lastName: uid("Soap") });

    const okRes = await soapRoute(makeReq(envelope("GetCitizen", { id: citizen.id }), rawKey));
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get("Content-Type")).toContain("text/xml");
    const okBody = await okRes.text();
    expect(okBody).toContain("<GetCitizenResponse>");
    expect(okBody).toContain(citizen.uniqueNumber);
    expect(okBody).toContain("SoapCitizen");

    const missingIdRes = await soapRoute(makeReq(envelope("GetCitizen", {}), rawKey));
    expect(missingIdRes.status).toBe(400);
    expect(await missingIdRes.text()).toContain("soapenv:Fault");

    const notFoundRes = await soapRoute(makeReq(envelope("GetCitizen", { id: "does-not-exist" }), rawKey));
    expect(notFoundRes.status).toBe(404);
    expect(await notFoundRes.text()).toContain("soapenv:Fault");
  });

  it("VerifyDocument : found=false pour un token inconnu, Fault pour un token absent", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:credentials"] });
    const { rawKey } = await createApiKey(admin, { name: "SOAP Verify Key", scopes: ["soap:legacy"] });

    const notFoundRes = await soapRoute(makeReq(envelope("VerifyDocument", { token: "unknown-token" }), rawKey));
    expect(notFoundRes.status).toBe(200);
    const body = await notFoundRes.text();
    expect(body).toContain("<VerifyDocumentResponse>");
    expect(body).toContain("<found>false</found>");

    const missingTokenRes = await soapRoute(makeReq(envelope("VerifyDocument", {}), rawKey));
    expect(missingTokenRes.status).toBe(400);
    expect(await missingTokenRes.text()).toContain("soapenv:Fault");
  });

  it("rejette une operation inconnue (Fault), une enveloppe mal formee (Fault, jamais une exception brute), un scope manquant (Fault)", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:credentials"] });
    const { rawKey: soapKey } = await createApiKey(admin, { name: "SOAP Unknown Op Key", scopes: ["soap:legacy"] });
    const { rawKey: otherScopeKey } = await createApiKey(admin, { name: "Wrong Scope Key", scopes: ["citizens:read"] });

    const unknownOpRes = await soapRoute(makeReq(envelope("DoSomethingElse", { x: "1" }), soapKey));
    expect(unknownOpRes.status).toBe(400);
    expect(await unknownOpRes.text()).toContain("Operation SOAP inconnue");

    const malformedRes = await soapRoute(makeReq("<soapenv:Envelope><soapenv:Body><Unclosed>", soapKey));
    expect(malformedRes.status).toBe(400);
    const malformedBody = await malformedRes.text();
    expect(malformedBody).toContain("soapenv:Fault");
    expect(malformedBody).toContain("mal forme");

    const wrongScopeRes = await soapRoute(makeReq(envelope("GetCitizen", { id: "x" }), otherScopeKey));
    expect(wrongScopeRes.status).toBe(403);
    expect(await wrongScopeRes.text()).toContain("soapenv:Fault");
  });
});

describe("Integration & Interoperability Center — moteur de synchronisation vers un systeme protocol=SOAP", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("envoie un lot XML/SOAP (pas JSON) a un systeme configure en protocol=SOAP, signature HMAC calculee sur le corps XML reellement envoye", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:create", "integration:sync_manage", "citizens:create"] });
    const city = await createTestCity();
    const arr = await createTestArrondissement(city.id, 4);
    await createTestCitizen(arr.id, { firstName: "SoapSync", lastName: "TestOne" });

    let receivedBody = "";
    let receivedContentType = "";
    let receivedSignature = "";
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        receivedBody = body;
        receivedContentType = req.headers["content-type"] as string;
        receivedSignature = req.headers["x-sigec-sync-signature"] as string;
        res.writeHead(200);
        res.end("ok");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const system = await createIntegrationSystem(admin, {
      name: "SOAP Receiver System", code: uid("SYS"), type: "GOVERNMENT", authType: "NONE", protocol: "SOAP",
      environment: "DEVELOPMENT", baseUrl: `http://127.0.0.1:${port}`,
    });
    const created = await createSyncJob(admin, { systemId: system.id, entityType: "CITIZENS", syncType: "MANUAL", endpointPath: "/sync/citizens" });

    const result = await runSyncJobNow(admin, created.id);
    server.close();
    expect(result.ok).toBe(true);
    expect(result.sent).toBeGreaterThan(0);

    expect(receivedContentType).toContain("text/xml");
    expect(receivedBody.trim().startsWith("<?xml")).toBe(true);
    expect(receivedBody).toContain("<SyncBatch>");
    expect(receivedBody).toContain("<entityType>CITIZENS</entityType>");
    expect(receivedBody).toContain("<record>");

    const expectedSignature = createHmac("sha256", created.secret).update(receivedBody).digest("hex");
    expect(receivedSignature).toBe(expectedSignature);
  });

  it("buildSoapSyncBatch echappe les valeurs et serialise les Date en ISO 8601", () => {
    const xml = buildSoapSyncBatch("CITIZENS", [{ firstName: "A & B", dateOfBirth: new Date("2020-01-15T00:00:00.000Z") }], "2026-09-07T00:00:00.000Z");
    expect(xml).toContain("A &amp; B");
    expect(xml).toContain("2020-01-15T00:00:00.000Z");
    expect(xml).toContain("<entityType>CITIZENS</entityType>");
    expect(xml).toContain("<syncedAt>2026-09-07T00:00:00.000Z</syncedAt>");
  });
});
