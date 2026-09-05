import { createHmac, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { encryptField, decryptField } from "@/lib/encryption";
import type { CurrentUser } from "@/lib/auth";

// Systeme de webhooks (module Integration & Interoperability, section 9/10).
// Chaque evenement metier reel appelle emitIntegrationEvent() ci-dessous —
// jamais l'inverse (aucune API externe ne "tire" les evenements, SIGEC-SM
// les pousse). Livraison signee HMAC-SHA256 (X-SIGEC-Signature), avec
// retry a delais croissants et passage en FAILED (jamais de tentative
// infinie) — voir attemptDelivery()/scheduleRetryOrFail() plus bas.
export const WEBHOOK_EVENTS = [
  "citizen.created", "citizen.updated",
  "birth_certificate.created", "marriage_certificate.created", "death_certificate.created",
  "payment.created", "payment.completed", "payment.failed",
  "receipt.created", "tax.created",
  "document.issued", "document.verified",
  "market.registration.created", "merchant.created",
] as const;

// Attempt 1 (immediat) -> 30s -> Attempt 2 -> 2min -> Attempt 3 -> 10min ->
// Attempt 4 -> si echec, FAILED (section 10 : jamais un 5e essai apres les
// 4 delais listes dans la spec, qui decrit un plafond, pas une file
// d'attente sans fin).
const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000];

function requirePermission(actor: CurrentUser) {
  if (!can(actor, "integration", "webhooks_manage")) throw new ApiError(403, "Permission insuffisante.");
}

export async function listWebhooks(actor: CurrentUser) {
  requirePermission(actor);
  return prisma.integrationWebhook.findMany({
    orderBy: { createdAt: "desc" },
    include: { system: { select: { name: true, code: true } }, _count: { select: { deliveries: true } } },
  });
}

export type CreateWebhookInput = { url: string; event: string; systemId?: string | null; timeoutMs?: number };

// Le secret n'est renvoye qu'ICI, au moment de la creation — meme
// convention que les cles API (section 17) : jamais relisible ensuite, il
// sert a l'externe pour VERIFIER notre signature sur chaque livraison.
export async function createWebhook(actor: CurrentUser, input: CreateWebhookInput) {
  requirePermission(actor);
  if (!WEBHOOK_EVENTS.includes(input.event as (typeof WEBHOOK_EVENTS)[number])) {
    throw new ApiError(400, "Evenement invalide.");
  }
  if (!/^https?:\/\//.test(input.url)) throw new ApiError(400, "URL invalide.");

  const secret = randomBytes(24).toString("hex");
  const created = await prisma.integrationWebhook.create({
    data: {
      url: input.url,
      event: input.event,
      systemId: input.systemId ?? null,
      secret: encryptField(secret)!,
      timeoutMs: input.timeoutMs ?? 5000,
      createdById: actor.id,
    },
  });

  await logAudit({ user: actor, action: "WEBHOOK_CREATED", module: "integration", entityType: "IntegrationWebhook", entityId: created.id, newValue: { url: created.url, event: created.event } });

  return { id: created.id, secret, url: created.url, event: created.event };
}

export async function setWebhookStatus(actor: CurrentUser, id: string, status: "ACTIVE" | "DISABLED") {
  requirePermission(actor);
  const webhook = await prisma.integrationWebhook.findUnique({ where: { id } });
  if (!webhook) throw new ApiError(404, "Webhook introuvable.");
  const updated = await prisma.integrationWebhook.update({ where: { id }, data: { status } });
  await logAudit({ user: actor, action: "WEBHOOK_STATUS_CHANGED", module: "integration", entityType: "IntegrationWebhook", entityId: id, newValue: { status } });
  return updated;
}

export async function deleteWebhook(actor: CurrentUser, id: string) {
  requirePermission(actor);
  const webhook = await prisma.integrationWebhook.findUnique({ where: { id } });
  if (!webhook) throw new ApiError(404, "Webhook introuvable.");
  await prisma.integrationWebhook.delete({ where: { id } });
  await logAudit({ user: actor, action: "WEBHOOK_DELETED", module: "integration", entityType: "IntegrationWebhook", entityId: id, oldValue: { url: webhook.url, event: webhook.event } });
}

export async function listWebhookDeliveries(actor: CurrentUser, webhookId: string) {
  requirePermission(actor);
  return prisma.integrationWebhookDelivery.findMany({ where: { webhookId }, orderBy: { createdAt: "desc" }, take: 50 });
}

async function scheduleRetryOrFail(deliveryId: string, attemptNumber: number, responseStatus: number | null, responseBody: string) {
  if (attemptNumber >= MAX_ATTEMPTS) {
    await prisma.integrationWebhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "FAILED", attemptCount: attemptNumber, responseStatus, responseBody: responseBody.slice(0, 500), nextRetryAt: null },
    });
    return;
  }
  const delayMs = RETRY_DELAYS_MS[attemptNumber - 1];
  await prisma.integrationWebhookDelivery.update({
    where: { id: deliveryId },
    data: { status: "RETRYING", attemptCount: attemptNumber, responseStatus, responseBody: responseBody.slice(0, 500), nextRetryAt: new Date(Date.now() + delayMs) },
  });
}

// Tente reellement UNE livraison HTTP (jamais un succes simule) — signe le
// corps avec le secret du webhook (dechiffre juste le temps du calcul,
// jamais journalise ni renvoye). Ne leve jamais : toute erreur (reseau,
// timeout, statut non-2xx) est geree par scheduleRetryOrFail ci-dessus,
// pour ne jamais interrompre l'appelant (l'operation metier qui a
// declenche l'evenement doit reussir independamment du sort du webhook).
async function attemptDelivery(webhook: { id: string; url: string; secret: string; timeoutMs: number }, delivery: { id: string; event: string; payload: string; attemptCount: number }) {
  const attemptNumber = delivery.attemptCount + 1;
  const secret = decryptField(webhook.secret)!;
  const signature = createHmac("sha256", secret).update(delivery.payload).digest("hex");

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SIGEC-Signature": signature,
        "X-SIGEC-Event": delivery.event,
        "X-SIGEC-Delivery-Id": delivery.id,
      },
      body: delivery.payload,
      signal: AbortSignal.timeout(webhook.timeoutMs),
    });
    const responseBody = await res.text().catch(() => "");
    if (res.ok) {
      await prisma.integrationWebhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "DELIVERED", attemptCount: attemptNumber, responseStatus: res.status, responseBody: responseBody.slice(0, 500), deliveredAt: new Date(), nextRetryAt: null },
      });
    } else {
      await scheduleRetryOrFail(delivery.id, attemptNumber, res.status, responseBody);
    }
  } catch (error) {
    await scheduleRetryOrFail(delivery.id, attemptNumber, null, error instanceof Error ? error.message : "Erreur reseau.");
  }
}

// Point d'entree pour tout module metier (citizens.ts, certificates.ts...)
// qui produit un des evenements de WEBHOOK_EVENTS. Ne leve jamais — un
// webhook qui echoue ne doit jamais faire echouer l'operation metier qui
// l'a declenche.
export async function emitIntegrationEvent(event: (typeof WEBHOOK_EVENTS)[number], payload: Record<string, unknown>) {
  try {
    const webhooks = await prisma.integrationWebhook.findMany({ where: { event, status: "ACTIVE" } });
    for (const webhook of webhooks) {
      const delivery = await prisma.integrationWebhookDelivery.create({
        data: { webhookId: webhook.id, event, payload: JSON.stringify(payload), status: "PENDING" },
      });
      await attemptDelivery(webhook, delivery);
    }
  } catch {
    // Ne jamais remonter : voir commentaire ci-dessus.
  }
}

// Declenchement manuel (section : bouton "Test Webhook") — utilise le meme
// pipeline de livraison reel qu'un vrai evenement, jamais un apercu simule.
export async function testWebhook(actor: CurrentUser, id: string) {
  requirePermission(actor);
  const webhook = await prisma.integrationWebhook.findUnique({ where: { id } });
  if (!webhook) throw new ApiError(404, "Webhook introuvable.");

  const payload = JSON.stringify({ test: true, event: webhook.event, sentAt: new Date().toISOString() });
  const delivery = await prisma.integrationWebhookDelivery.create({
    data: { webhookId: webhook.id, event: webhook.event, payload, status: "PENDING" },
  });
  await attemptDelivery(webhook, delivery);
  return prisma.integrationWebhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
}

// Appelee par le cron externe (section 10 : retry — voir
// app/api/cron/webhook-retries). Traite toute livraison RETRYING dont
// nextRetryAt est echu.
export async function processWebhookRetries() {
  const due = await prisma.integrationWebhookDelivery.findMany({
    where: { status: "RETRYING", nextRetryAt: { lte: new Date() } },
    include: { webhook: true },
  });
  for (const delivery of due) {
    await attemptDelivery(delivery.webhook, delivery);
  }
  return { processed: due.length };
}
