import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateObligationNumber } from "@/lib/ids";

// Somme due generee pour un contribuable/emplacement (section 11). Le solde
// n'est jamais stocke : toujours recalcule a la lecture, jamais negatif.
function withBalance<T extends { initialAmount: number; paidAmount: number }>(o: T) {
  return { ...o, balance: Math.max(0, o.initialAmount - o.paidAmount) };
}

export async function listObligations(user: CurrentUser, filters?: { status?: string; citizenId?: string }) {
  const rows = await prisma.obligationPaiement.findMany({
    where: {
      ...recordScopeWhere(user),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.citizenId ? { citizenId: filters.citizenId } : {}),
    },
    include: { citizen: true, business: true, marketStall: { include: { market: true } }, tarif: true, arrondissement: true },
    orderBy: { dueDate: "asc" },
    take: 200,
  });
  return rows.map(withBalance);
}

export async function getObligation(user: CurrentUser, id: string) {
  const row = await prisma.obligationPaiement.findUnique({
    where: { id },
    include: { citizen: true, business: true, marketStall: { include: { market: true } }, tarif: true, arrondissement: true, payments: true },
  });
  if (!row) throw new ApiError(404, "Obligation introuvable.");
  if (!canAccessArrondissement(user, row.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");
  return withBalance(row);
}

export type CreateObligationInput = {
  citizenId: string;
  businessId?: string | null;
  marketStallId?: string | null;
  tarifId: string;
  period: string;
  dueDate: string;
};

// Genere la somme due a partir du tarif applicable (section 10 : "les
// montants doivent venir du referentiel tarifaire" — jamais un montant
// saisi librement). arrondissementId est derive de l'emplacement (boutique
// ou etal) si fourni, sinon du contribuable lui-meme.
export async function createObligation(actor: CurrentUser, input: CreateObligationInput) {
  if (!can(actor, "obligations", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.citizenId || !input.tarifId || !input.period?.trim() || !input.dueDate) {
    throw new ApiError(400, "Contribuable, tarif, periode et echeance requis.");
  }

  const citizen = await prisma.citizen.findUnique({ where: { id: input.citizenId } });
  if (!citizen) throw new ApiError(404, "Contribuable introuvable.");

  const tarif = await prisma.tarifMunicipal.findUnique({ where: { id: input.tarifId } });
  if (!tarif || tarif.status !== "ACTIF") throw new ApiError(400, "Tarif invalide ou inactif.");

  let arrondissementId = citizen.arrondissementId;
  if (input.businessId) {
    const business = await prisma.business.findUnique({ where: { id: input.businessId } });
    if (!business) throw new ApiError(404, "Boutique introuvable.");
    arrondissementId = business.arrondissementId;
  } else if (input.marketStallId) {
    const stall = await prisma.marketStall.findUnique({ where: { id: input.marketStallId }, include: { market: true } });
    if (!stall) throw new ApiError(404, "Emplacement introuvable.");
    arrondissementId = stall.market.arrondissementId;
  }

  if (!canAccessArrondissement(actor, arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");

  const created = await prisma.obligationPaiement.create({
    data: {
      number: generateObligationNumber(),
      citizenId: input.citizenId,
      businessId: input.businessId || null,
      marketStallId: input.marketStallId || null,
      tarifId: input.tarifId,
      period: input.period.trim(),
      initialAmount: tarif.amount,
      dueDate: new Date(input.dueDate),
      arrondissementId,
    },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "obligations",
    entityType: "ObligationPaiement",
    entityId: created.id,
    arrondissementId,
    newValue: { number: created.number, amount: created.initialAmount, period: created.period },
  });

  return withBalance(created);
}

export async function cancelObligation(actor: CurrentUser, id: string, reason: string) {
  if (!can(actor, "obligations", "cancel")) throw new ApiError(403, "Permission insuffisante.");
  if (!reason?.trim()) throw new ApiError(400, "Un motif est requis.");
  const before = await prisma.obligationPaiement.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Obligation introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");
  if (before.paidAmount > 0) throw new ApiError(400, "Une obligation deja partiellement payee ne peut pas etre annulee.");

  const updated = await prisma.obligationPaiement.update({ where: { id }, data: { status: "ANNULE" } });
  await logAudit({
    user: actor,
    action: "CANCEL",
    module: "obligations",
    entityType: "ObligationPaiement",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status, reason },
  });
  return updated;
}

// Applique un paiement a une obligation dans la MEME transaction que la
// creation du Payment (voir services/payments.ts) : incremente paidAmount,
// recalcule le statut, jamais de solde negatif (clamp implicite : on ne
// verifie pas le depassement ici, un paiement > solde reste possible mais
// paidAmount ne depasse jamais logiquement ce qui a ete reellement recu).
export async function applyPaymentToObligation(tx: Prisma.TransactionClient, obligationId: string, amount: number) {
  const obligation = await tx.obligationPaiement.findUnique({ where: { id: obligationId } });
  if (!obligation) throw new ApiError(404, "Obligation introuvable.");
  if (obligation.status === "ANNULE") throw new ApiError(400, "Cette obligation est annulee.");

  const paidAmount = obligation.paidAmount + amount;
  const status = paidAmount >= obligation.initialAmount ? "PAYE" : paidAmount > 0 ? "PARTIELLEMENT_PAYE" : obligation.status;

  return tx.obligationPaiement.update({ where: { id: obligationId }, data: { paidAmount, status } });
}
