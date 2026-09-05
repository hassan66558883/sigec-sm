import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ApiError } from "@/lib/api";
import type { CurrentUser } from "@/lib/auth";

const PAGE_SIZE = 25;

export type IntegrationLogFilters = { systemId?: string; endpoint?: string; success?: boolean; correlationId?: string };

export async function listIntegrationLogsPage(actor: CurrentUser, filters: IntegrationLogFilters = {}, page = 1) {
  if (!can(actor, "integration", "logs")) throw new ApiError(403, "Permission insuffisante.");
  const where = {
    ...(filters.systemId ? { systemId: filters.systemId } : {}),
    ...(filters.endpoint ? { endpoint: { contains: filters.endpoint } } : {}),
    ...(filters.success !== undefined ? { success: filters.success } : {}),
    ...(filters.correlationId ? { correlationId: filters.correlationId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.integrationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { system: { select: { name: true, code: true } } },
    }),
    prisma.integrationLog.count({ where }),
  ]);
  return { rows, total, page, pageSize: PAGE_SIZE };
}

// Compteurs reels pour le Integration Dashboard (section 4) — jamais de
// chiffres fictifs.
export async function getIntegrationDashboardSummary(actor: CurrentUser) {
  if (!can(actor, "integration", "view")) throw new ApiError(403, "Permission insuffisante.");
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [connectedSystems, systemsOnline, systemsOffline, activeApiKeys, callsToday, successToday, failedToday, openErrors] = await Promise.all([
    prisma.integrationSystem.count({ where: { enabled: true } }),
    prisma.integrationSystem.count({ where: { enabled: true, status: "CONNECTED" } }),
    prisma.integrationSystem.count({ where: { enabled: true, status: "OFFLINE" } }),
    prisma.integrationApiKey.count({ where: { status: "ACTIVE" } }),
    prisma.integrationLog.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.integrationLog.count({ where: { createdAt: { gte: startOfDay }, success: true } }),
    prisma.integrationLog.count({ where: { createdAt: { gte: startOfDay }, success: false } }),
    prisma.integrationError.count({ where: { status: { in: ["NEW", "RETRYING"] } } }),
  ]);

  const successRate = callsToday > 0 ? Math.round((successToday / callsToday) * 1000) / 10 : 100;

  return { connectedSystems, systemsOnline, systemsOffline, activeApiKeys, callsToday, successToday, failedToday, openErrors, successRate };
}
