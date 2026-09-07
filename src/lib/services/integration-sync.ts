import { createHmac, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { encryptField, decryptField } from "@/lib/encryption";
import { CITIZEN_SELECT } from "@/lib/services/integration-v1";
import { buildSoapSyncBatch } from "@/lib/integration/soap";
import type { CurrentUser } from "@/lib/auth";
import type { IntegrationSyncJob } from "@/generated/prisma/client";

// Synchronization Engine (section 13) — scope volontairement retreint a
// l'EXPORT par lot (voir le commentaire sur le modele IntegrationSyncJob,
// prisma/schema.prisma) : "Real-time"/"Event-based" sont deja couverts par
// le systeme de webhooks. Ce moteur couvre "Scheduled"/"Manual" — un lot
// periodique ou declenche a la main.
export const ENTITY_TYPES = ["CITIZENS"] as const;
export const SYNC_TYPES = ["SCHEDULED", "MANUAL"] as const;
const SYNC_BATCH_SIZE = 100;

function requirePermission(actor: CurrentUser) {
  if (!can(actor, "integration", "sync_manage")) throw new ApiError(403, "Permission insuffisante.");
}

export async function listSyncJobs(actor: CurrentUser) {
  requirePermission(actor);
  return prisma.integrationSyncJob.findMany({
    orderBy: { createdAt: "desc" },
    include: { system: { select: { name: true, code: true, baseUrl: true } }, _count: { select: { runs: true } } },
  });
}

export async function listSyncRuns(actor: CurrentUser, jobId: string) {
  requirePermission(actor);
  return prisma.integrationSyncRun.findMany({ where: { jobId }, orderBy: { startedAt: "desc" }, take: 50 });
}

export type CreateSyncJobInput = { systemId: string; entityType: string; syncType: string; intervalMinutes?: number; endpointPath: string };

export async function createSyncJob(actor: CurrentUser, input: CreateSyncJobInput) {
  requirePermission(actor);
  if (!ENTITY_TYPES.includes(input.entityType as (typeof ENTITY_TYPES)[number])) throw new ApiError(400, "Type d'entite non pris en charge pour la synchronisation.");
  if (!SYNC_TYPES.includes(input.syncType as (typeof SYNC_TYPES)[number])) throw new ApiError(400, "Type de synchronisation invalide.");
  if (input.syncType === "SCHEDULED" && (!input.intervalMinutes || input.intervalMinutes < 1)) {
    throw new ApiError(400, "intervalMinutes est requis (et > 0) pour une synchronisation SCHEDULED.");
  }
  if (!input.endpointPath?.startsWith("/")) throw new ApiError(400, "endpointPath doit commencer par '/'.");

  const system = await prisma.integrationSystem.findUnique({ where: { id: input.systemId } });
  if (!system) throw new ApiError(404, "Systeme introuvable.");
  if (!system.baseUrl) throw new ApiError(400, "Ce systeme n'a pas d'URL de base configuree.");

  const secret = randomBytes(24).toString("hex");
  const job = await prisma.integrationSyncJob.create({
    data: {
      systemId: input.systemId,
      entityType: input.entityType,
      syncType: input.syncType,
      intervalMinutes: input.syncType === "SCHEDULED" ? input.intervalMinutes : null,
      endpointPath: input.endpointPath,
      secret: encryptField(secret)!,
      nextSyncAt: input.syncType === "SCHEDULED" ? new Date() : null,
      createdById: actor.id,
    },
  });

  await logAudit({ user: actor, action: "SYNC_JOB_CREATED", module: "integration", entityType: "IntegrationSyncJob", entityId: job.id, newValue: { systemId: input.systemId, syncType: input.syncType, endpointPath: input.endpointPath } });

  return { id: job.id, secret };
}

export async function setSyncJobStatus(actor: CurrentUser, id: string, status: "ACTIVE" | "DISABLED") {
  requirePermission(actor);
  const job = await prisma.integrationSyncJob.findUnique({ where: { id } });
  if (!job) throw new ApiError(404, "Synchronisation introuvable.");
  const updated = await prisma.integrationSyncJob.update({ where: { id }, data: { status } });
  await logAudit({ user: actor, action: "SYNC_JOB_STATUS_CHANGED", module: "integration", entityType: "IntegrationSyncJob", entityId: id, newValue: { status } });
  return updated;
}

async function advanceNextSync(job: Pick<IntegrationSyncJob, "id" | "syncType" | "intervalMinutes">) {
  if (job.syncType === "SCHEDULED" && job.intervalMinutes) {
    await prisma.integrationSyncJob.update({ where: { id: job.id }, data: { nextSyncAt: new Date(Date.now() + job.intervalMinutes * 60_000) } });
  }
}

// Execute reellement UN lot pour un job donne (jamais un resultat simule) —
// n'avance job.lastSyncAt (le marqueur "deja envoye jusqu'ici") QUE sur un
// succes HTTP reel : un lot en echec doit rester eligible au prochain
// essai, jamais silencieusement abandonne. nextSyncAt (pour SCHEDULED)
// avance en revanche dans tous les cas, pour eviter qu'un job en panne ne
// martele l'endpoint en boucle sans respecter son propre intervalle.
export async function runSyncJob(job: IntegrationSyncJob) {
  const run = await prisma.integrationSyncRun.create({ data: { jobId: job.id, status: "RUNNING" } });
  const since = job.lastSyncAt ?? new Date(0);

  const records =
    job.entityType === "CITIZENS"
      ? await prisma.citizen.findMany({ where: { updatedAt: { gt: since } }, select: CITIZEN_SELECT, orderBy: { updatedAt: "asc" }, take: SYNC_BATCH_SIZE })
      : [];

  if (records.length === 0) {
    await prisma.integrationSyncRun.update({ where: { id: run.id }, data: { status: "SUCCESS", completedAt: new Date() } });
    await prisma.integrationSyncJob.update({ where: { id: job.id }, data: { lastSyncAt: new Date() } });
    await advanceNextSync(job);
    return { ok: true, sent: 0 };
  }

  const system = await prisma.integrationSystem.findUnique({ where: { id: job.systemId } });
  if (!system?.baseUrl) {
    await prisma.integrationSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), recordsFailed: records.length, errorMessage: "Aucune URL de base configuree pour ce systeme." } });
    await advanceNextSync(job);
    return { ok: false, sent: 0 };
  }

  const url = `${system.baseUrl}${job.endpointPath}`;
  const syncedAt = new Date().toISOString();
  // Le protocole du systeme cible (section 15) determine la serialisation
  // du lot : XML/SOAP pour un systeme legacy, JSON sinon — meme contenu,
  // meme signature HMAC sur le corps effectivement envoye.
  const isSoap = system.protocol === "SOAP";
  const payload = isSoap
    ? buildSoapSyncBatch(job.entityType, records, syncedAt)
    : JSON.stringify({ entityType: job.entityType, records, syncedAt });
  const secret = decryptField(job.secret)!;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": isSoap ? "text/xml; charset=utf-8" : "application/json",
        "X-SIGEC-Sync-Signature": signature,
        "X-SIGEC-Sync-Job-Id": job.id,
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      await prisma.integrationSyncRun.update({ where: { id: run.id }, data: { status: "SUCCESS", completedAt: new Date(), recordsSent: records.length } });
      await prisma.integrationSyncJob.update({ where: { id: job.id }, data: { lastSyncAt: new Date() } });
      await advanceNextSync(job);
      return { ok: true, sent: records.length };
    }
    const message = `Reponse HTTP ${res.status}.`;
    await prisma.integrationSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), recordsFailed: records.length, errorMessage: message } });
    await prisma.integrationError.create({ data: { systemId: job.systemId, endpoint: url, errorType: "SYNC_FAILED", message } });
    await advanceNextSync(job);
    return { ok: false, sent: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur reseau.";
    await prisma.integrationSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), recordsFailed: records.length, errorMessage: message } });
    await prisma.integrationError.create({ data: { systemId: job.systemId, endpoint: url, errorType: "SYNC_FAILED", message } });
    await advanceNextSync(job);
    return { ok: false, sent: 0 };
  }
}

// Declenchement manuel ("Run Sync Now") — meme pipeline reel qu'un
// declenchement automatique, quel que soit syncType (un job SCHEDULED peut
// aussi etre force manuellement).
export async function runSyncJobNow(actor: CurrentUser, id: string) {
  requirePermission(actor);
  const job = await prisma.integrationSyncJob.findUnique({ where: { id } });
  if (!job) throw new ApiError(404, "Synchronisation introuvable.");
  const result = await runSyncJob(job);
  await logAudit({ user: actor, action: "SYNC_JOB_RUN_MANUAL", module: "integration", entityType: "IntegrationSyncJob", entityId: id, newValue: result });
  return result;
}

// Appelee par le cron externe (voir app/api/cron/sync-jobs) — traite tout
// job SCHEDULED actif dont l'echeance est passee.
export async function runDueSyncJobs() {
  const due = await prisma.integrationSyncJob.findMany({ where: { status: "ACTIVE", syncType: "SCHEDULED", nextSyncAt: { lte: new Date() } } });
  let processed = 0;
  for (const job of due) {
    await runSyncJob(job);
    processed++;
  }
  return { processed };
}
