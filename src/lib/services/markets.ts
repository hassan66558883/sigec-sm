import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateEmplacementCode } from "@/lib/ids";

const MARKET_STATUSES = ["ACTIVE", "INACTIVE", "FERME"];
const STALL_TYPES = ["ETAL", "KIOSQUE", "HANGAR", "PLACE", "AUTRE"];

export async function listMarkets(user: CurrentUser) {
  return prisma.market.findMany({
    where: recordScopeWhere(user),
    include: { arrondissement: true, quartier: true, stalls: { include: { occupant: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getMarket(user: CurrentUser, id: string) {
  const market = await prisma.market.findUnique({
    where: { id },
    include: { arrondissement: true, quartier: true, stalls: { include: { occupant: true } } },
  });
  if (!market) throw new ApiError(404, "Marche introuvable.");
  if (!canAccessArrondissement(user, market.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");
  return market;
}

export type CreateMarketInput = {
  name: string;
  address?: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  responsibleName?: string;
  description?: string;
  photoUrl?: string | null;
  arrondissementId: string;
  quartierId?: string | null;
};

// Marche (section 6). Meme convention d'identifiant structure que Business
// (section 7, ex NDJ-A01-MKT-000001), genere apres l'insertion.
export async function createMarket(actor: CurrentUser, input: CreateMarketInput) {
  if (!can(actor, "markets", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.name?.trim()) throw new ApiError(400, "Nom du marche requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }

  const arrondissement = await prisma.arrondissement.findUnique({ where: { id: input.arrondissementId } });
  if (!arrondissement) throw new ApiError(400, "Arrondissement invalide.");
  const quartier = input.quartierId ? await prisma.quartier.findUnique({ where: { id: input.quartierId } }) : null;

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.market.create({
      data: {
        name: input.name.trim(),
        address: input.address?.trim(),
        gpsLat: input.gpsLat ?? null,
        gpsLng: input.gpsLng ?? null,
        responsibleName: input.responsibleName?.trim(),
        description: input.description?.trim(),
        photoUrl: input.photoUrl?.trim() || null,
        arrondissementId: input.arrondissementId,
        quartierId: input.quartierId || null,
      },
    });
    const code = generateEmplacementCode({
      arrondissementNumber: arrondissement.number,
      quartierCode: quartier?.code,
      typeCode: "MKT",
      sequence: row.sequence,
    });
    return tx.market.update({ where: { id: row.id }, data: { code } });
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "markets",
    entityType: "Market",
    entityId: created.id,
    arrondissementId: created.arrondissementId,
    newValue: { name: created.name, code: created.code },
  });
  return created;
}

export async function setMarketStatus(actor: CurrentUser, id: string, status: string) {
  if (!can(actor, "markets", "edit")) throw new ApiError(403, "Permission insuffisante.");
  if (!MARKET_STATUSES.includes(status)) throw new ApiError(400, "Statut invalide.");
  const before = await prisma.market.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Marche introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");

  const updated = await prisma.market.update({ where: { id }, data: { status } });
  await logAudit({
    user: actor,
    action: "UPDATE",
    module: "markets",
    entityType: "Market",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status },
  });
  return updated;
}

export async function createStall(actor: CurrentUser, input: { marketId: string; code: string; type?: string }) {
  if (!can(actor, "markets", "create")) throw new ApiError(403, "Permission insuffisante.");
  const market = await prisma.market.findUnique({ where: { id: input.marketId } });
  if (!market) throw new ApiError(404, "Marche introuvable.");
  if (!canAccessArrondissement(actor, market.arrondissementId)) {
    throw new ApiError(403, "Marche hors de votre perimetre.");
  }
  if (!input.code?.trim()) throw new ApiError(400, "Code de l'emplacement requis.");
  if (input.type && !STALL_TYPES.includes(input.type)) throw new ApiError(400, "Type d'emplacement invalide.");
  const created = await prisma.marketStall.create({
    data: { marketId: input.marketId, code: input.code.trim(), type: input.type || null },
  });
  await logAudit({ user: actor, action: "CREATE", module: "markets", entityType: "MarketStall", entityId: created.id, arrondissementId: market.arrondissementId, newValue: { code: created.code } });
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
  // Un emplacement ne peut avoir qu'un seul occupant actif a la fois (module
  // paiement en ligne, section 4) : reattribuer un emplacement deja OCCUPIED
  // a un autre contribuable exige de d'abord le liberer explicitement
  // (AVAILABLE), jamais un simple ecrasement silencieux de l'occupant.
  if (status === "OCCUPIED" && stall.status === "OCCUPIED" && stall.occupantId && stall.occupantId !== occupantId) {
    throw new ApiError(409, "Cet emplacement est deja occupe — liberez-le avant de l'attribuer a un autre contribuable.");
  }
  const updated = await prisma.marketStall.update({
    where: { id },
    data: { status, occupantId: status === "OCCUPIED" ? occupantId : null },
  });
  await logAudit({ user: actor, action: "UPDATE", module: "markets", entityType: "MarketStall", entityId: id, arrondissementId: stall.market.arrondissementId, newValue: { status } });
  return updated;
}
