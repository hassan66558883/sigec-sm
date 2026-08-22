import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function listMarkets(user: CurrentUser) {
  return prisma.market.findMany({
    where: recordScopeWhere(user),
    include: { arrondissement: true, stalls: { include: { occupant: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createMarket(actor: CurrentUser, input: { name: string; arrondissementId: string; quartierId?: string | null }) {
  if (!can(actor, "markets", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.name?.trim()) throw new ApiError(400, "Nom du marche requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }
  const created = await prisma.market.create({
    data: { name: input.name.trim(), arrondissementId: input.arrondissementId, quartierId: input.quartierId || null },
  });
  await logAudit({ user: actor, action: "CREATE", module: "markets", entityType: "Market", entityId: created.id, newValue: { name: created.name } });
  return created;
}

export async function createStall(actor: CurrentUser, input: { marketId: string; code: string }) {
  if (!can(actor, "markets", "create")) throw new ApiError(403, "Permission insuffisante.");
  const market = await prisma.market.findUnique({ where: { id: input.marketId } });
  if (!market) throw new ApiError(404, "Marche introuvable.");
  if (!canAccessArrondissement(actor, market.arrondissementId)) {
    throw new ApiError(403, "Marche hors de votre perimetre.");
  }
  if (!input.code?.trim()) throw new ApiError(400, "Code de l'emplacement requis.");
  const created = await prisma.marketStall.create({ data: { marketId: input.marketId, code: input.code.trim() } });
  await logAudit({ user: actor, action: "CREATE", module: "markets", entityType: "MarketStall", entityId: created.id, newValue: { code: created.code } });
  return created;
}

// status: AVAILABLE | OCCUPIED | RESERVED | SUSPENDED (section 11)
export async function setStallStatus(actor: CurrentUser, id: string, status: string, occupantId?: string | null) {
  if (!can(actor, "markets", "create")) throw new ApiError(403, "Permission insuffisante.");
  const validStatuses = ["AVAILABLE", "OCCUPIED", "RESERVED", "SUSPENDED"];
  if (!validStatuses.includes(status)) throw new ApiError(400, "Statut invalide.");
  const stall = await prisma.marketStall.findUnique({ where: { id }, include: { market: true } });
  if (!stall) throw new ApiError(404, "Emplacement introuvable.");
  if (!canAccessArrondissement(actor, stall.market.arrondissementId)) {
    throw new ApiError(403, "Emplacement hors de votre perimetre.");
  }
  const updated = await prisma.marketStall.update({
    where: { id },
    data: { status, occupantId: status === "OCCUPIED" ? occupantId : null },
  });
  await logAudit({ user: actor, action: "UPDATE", module: "markets", entityType: "MarketStall", entityId: id, newValue: { status } });
  return updated;
}
