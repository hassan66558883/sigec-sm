import { describe, it, expect, afterAll } from "vitest";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { createHmac } from "crypto";
import {
  createWebhook,
  setWebhookStatus,
  deleteWebhook,
  testWebhook,
  emitIntegrationEvent,
  processWebhookRetries,
  listWebhookDeliveries,
} from "../src/lib/services/integration-webhooks";
import { createTestUser, testPrisma, closeTestDb } from "./helpers/fixtures";

describe("Integration & Interoperability Center — webhooks", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("cree un webhook (secret renvoye une seule fois), refuse un evenement ou une URL invalide, refuse sans permission", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:webhooks_manage"] });
    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });

    const created = await createWebhook(admin, { url: "https://partner.example.td/hooks", event: "citizen.created" });
    expect(created.secret).toHaveLength(48);

    const stored = await testPrisma.integrationWebhook.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.secret).not.toBe(created.secret); // chiffre, jamais en clair

    await expect(createWebhook(admin, { url: "https://x.td", event: "not.a.real.event" })).rejects.toMatchObject({ status: 400 });
    await expect(createWebhook(admin, { url: "not-a-url", event: "citizen.created" })).rejects.toMatchObject({ status: 400 });
    await expect(createWebhook(noPerm, { url: "https://x.td", event: "citizen.created" })).rejects.toMatchObject({ status: 403 });
  });

  it("livre reellement un evenement, signe le corps avec le secret du webhook (verifiable par le destinataire)", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:webhooks_manage"] });

    let receivedSignature: string | null = null;
    let receivedBody = "";
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        receivedSignature = req.headers["x-sigec-signature"] as string;
        receivedBody = body;
        res.writeHead(200);
        res.end("received");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const created = await createWebhook(admin, { url: `http://127.0.0.1:${port}`, event: "citizen.created" });
    await emitIntegrationEvent("citizen.created", { id: "test-citizen-id", firstName: "Test" });

    // Laisse le temps a la requete HTTP (locale, quasi instantanee) de se
    // terminer et a la mise a jour de se propager.
    await new Promise((resolve) => setTimeout(resolve, 300));
    server.close();

    const expectedSignature = createHmac("sha256", await decryptSecret(created.id)).update(receivedBody).digest("hex");
    expect(receivedSignature).toBe(expectedSignature);

    const deliveries = await listWebhookDeliveries(admin, created.id);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("DELIVERED");
    expect(deliveries[0].attemptCount).toBe(1);
  });

  it("un webhook DESACTIVE ne recoit rien ; un evenement sans abonne actif ne cree aucune livraison", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:webhooks_manage"] });
    const created = await createWebhook(admin, { url: "https://unused.example.td/hooks", event: "merchant.created" });
    await setWebhookStatus(admin, created.id, "DISABLED");

    await emitIntegrationEvent("merchant.created", { id: "x" });

    const deliveries = await listWebhookDeliveries(admin, created.id);
    expect(deliveries).toHaveLength(0);
  });

  it("echec de livraison : passe en RETRYING avec un delai croissant, puis FAILED apres le nombre maximum de tentatives", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:webhooks_manage"] });
    const created = await createWebhook(admin, { url: "http://127.0.0.1:1", event: "payment.failed" });

    await emitIntegrationEvent("payment.failed", { id: "p1" });
    let deliveries = await listWebhookDeliveries(admin, created.id);
    expect(deliveries[0].status).toBe("RETRYING");
    expect(deliveries[0].attemptCount).toBe(1);
    expect(deliveries[0].nextRetryAt).not.toBeNull();

    // Force l'echeance pour ne pas attendre le vrai delai (30s) dans le test.
    await testPrisma.integrationWebhookDelivery.update({ where: { id: deliveries[0].id }, data: { nextRetryAt: new Date(Date.now() - 1000) } });
    await processWebhookRetries();
    deliveries = await listWebhookDeliveries(admin, created.id);
    expect(deliveries[0].attemptCount).toBe(2);
    expect(deliveries[0].status).toBe("RETRYING");

    // Simule l'arrivee a la derniere tentative (4e) : encore un echec doit
    // desormais marquer FAILED, jamais programmer un 5e essai.
    await testPrisma.integrationWebhookDelivery.update({ where: { id: deliveries[0].id }, data: { attemptCount: 3, nextRetryAt: new Date(Date.now() - 1000) } });
    await processWebhookRetries();
    deliveries = await listWebhookDeliveries(admin, created.id);
    expect(deliveries[0].attemptCount).toBe(4);
    expect(deliveries[0].status).toBe("FAILED");
    expect(deliveries[0].nextRetryAt).toBeNull();
  });

  it("Test Webhook declenche une vraie livraison via le meme pipeline ; suppression retire le webhook", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:webhooks_manage"] });
    const created = await createWebhook(admin, { url: "http://127.0.0.1:1", event: "tax.created" });

    const delivery = await testWebhook(admin, created.id);
    expect(delivery.event).toBe("tax.created");
    expect(["RETRYING", "FAILED"]).toContain(delivery.status);

    await deleteWebhook(admin, created.id);
    await expect(testPrisma.integrationWebhook.findUniqueOrThrow({ where: { id: created.id } })).rejects.toBeTruthy();
  });
});

async function decryptSecret(webhookId: string): Promise<string> {
  const { decryptField } = await import("../src/lib/encryption");
  const row = await testPrisma.integrationWebhook.findUniqueOrThrow({ where: { id: webhookId } });
  return decryptField(row.secret)!;
}
