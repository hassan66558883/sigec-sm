import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ApiError } from "@/lib/api";
import { pingUrl } from "@/lib/services/integration-systems";
import type { CurrentUser } from "@/lib/auth";

// Health Monitoring (section 23) — distinct du Test Connection manuel :
// verification PERIODIQUE (voir /api/cron/health-checks), une ligne
// IntegrationHealthCheck par execution reelle (jamais un resultat simule),
// utilisee pour calculer un taux de disponibilite dans la duree plutot que
// de ne connaitre que le tout dernier resultat.
const RECENT_CHECKS_WINDOW = 20;

function requirePermission(actor: CurrentUser) {
  if (!can(actor, "integration", "health")) throw new ApiError(403, "Permission insuffisante.");
}

// Une seule IntegrationError par PASSAGE a l'etat en panne (jamais une par
// verification periodique en echec) — meme principe deja applique au
// verrouillage de compte (module securite) : un systeme en panne depuis 3
// jours ne doit generer qu'une seule alerte, pas une toutes les 5 minutes.
export async function checkSystemHealth(system: { id: string; baseUrl: string | null; lastTestOk: boolean | null }) {
  if (!system.baseUrl) return null;

  const result = await pingUrl(system.baseUrl);

  await prisma.integrationHealthCheck.create({
    data: { systemId: system.id, ok: result.ok, latencyMs: result.latencyMs, message: result.message },
  });

  const wasHealthy = system.lastTestOk !== false;
  await prisma.integrationSystem.update({
    where: { id: system.id },
    data: { lastTestAt: new Date(), lastTestOk: result.ok, lastTestMessage: result.message, status: result.ok ? "CONNECTED" : "OFFLINE" },
  });

  if (!result.ok && wasHealthy) {
    await prisma.integrationError.create({
      data: { systemId: system.id, endpoint: system.baseUrl, errorType: "HEALTH_CHECK_FAILED", message: result.message },
    });
  }

  return result;
}

// Appelee par le cron externe (section 23) — verifie tous les systemes
// actifs ayant une URL de base configuree.
export async function runHealthChecks() {
  const systems = await prisma.integrationSystem.findMany({ where: { enabled: true, baseUrl: { not: null } } });
  let checked = 0;
  let failed = 0;
  for (const system of systems) {
    const result = await checkSystemHealth(system);
    if (result) {
      checked++;
      if (!result.ok) failed++;
    }
  }
  return { checked, failed };
}

export type HealthLevel = "HEALTHY" | "DEGRADED" | "OFFLINE" | "UNKNOWN";

async function computeHealthDetails(systemId: string, lastTestOk: boolean | null) {
  const recentChecks = await prisma.integrationHealthCheck.findMany({
    where: { systemId },
    orderBy: { createdAt: "desc" },
    take: RECENT_CHECKS_WINDOW,
  });

  const okCount = recentChecks.filter((c) => c.ok).length;
  const uptimePct = recentChecks.length > 0 ? Math.round((okCount / recentChecks.length) * 1000) / 10 : null;
  const latencies = recentChecks.filter((c) => c.latencyMs !== null).map((c) => c.latencyMs as number);
  const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  const lastSuccess = recentChecks.find((c) => c.ok)?.createdAt ?? null;
  const lastFailure = recentChecks.find((c) => !c.ok)?.createdAt ?? null;

  let level: HealthLevel = "UNKNOWN";
  if (recentChecks.length === 0) level = "UNKNOWN";
  else if (lastTestOk === false) level = "OFFLINE";
  else if (uptimePct !== null && uptimePct < 90) level = "DEGRADED";
  else level = "HEALTHY";

  return { level, uptimePct, avgLatencyMs, lastSuccess, lastFailure, recentChecks: recentChecks.slice(0, 10) };
}

export async function listSystemsHealth(actor: CurrentUser) {
  requirePermission(actor);
  const systems = await prisma.integrationSystem.findMany({ where: { enabled: true }, orderBy: { name: "asc" } });
  return Promise.all(
    systems.map(async (system) => ({
      system,
      health: await computeHealthDetails(system.id, system.lastTestOk),
    })),
  );
}

export async function getSystemHealth(actor: CurrentUser, systemId: string) {
  requirePermission(actor);
  const system = await prisma.integrationSystem.findUnique({ where: { id: systemId } });
  if (!system) throw new ApiError(404, "Systeme introuvable.");
  return { system, health: await computeHealthDetails(system.id, system.lastTestOk) };
}

// Declenchement manuel depuis /admin/integration/health ("Run Health Check
// Now") — memes effets qu'une execution automatique du cron (une ligne
// IntegrationHealthCheck, une IntegrationError seulement sur transition).
export async function runHealthCheckNow(actor: CurrentUser, systemId: string) {
  requirePermission(actor);
  const system = await prisma.integrationSystem.findUnique({ where: { id: systemId } });
  if (!system) throw new ApiError(404, "Systeme introuvable.");
  if (!system.baseUrl) throw new ApiError(400, "Aucune URL de base configuree pour ce systeme.");
  const result = await checkSystemHealth(system);
  return { result, health: await computeHealthDetails(system.id, result?.ok ?? system.lastTestOk) };
}
