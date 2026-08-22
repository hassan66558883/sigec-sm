import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

export async function listTaxTypes() {
  return prisma.taxType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function listPayments(user: CurrentUser) {
  return prisma.payment.findMany({
    where: recordScopeWhere(user),
    include: { payer: true, taxType: true, business: true, marketStall: { include: { market: true } }, arrondissement: true },
    orderBy: { paymentDate: "desc" },
    take: 100,
  });
}

export type RecordPaymentInput = {
  payerId: string;
  amount: number;
  paymentMethod: string;
  taxTypeId?: string | null;
  businessId?: string | null;
  marketStallId?: string | null;
  arrondissementId?: string | null; // null = recette Mairie Centrale (reserve aux comptes CENTRAL)
};

export async function recordPayment(actor: CurrentUser, input: RecordPaymentInput) {
  if (!can(actor, "payments", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.payerId) throw new ApiError(400, "Payeur requis.");
  if (!input.amount || input.amount <= 0) throw new ApiError(400, "Montant invalide.");
  if (!input.paymentMethod?.trim()) throw new ApiError(400, "Mode de paiement requis.");

  // Un agent d'arrondissement ne peut collecter que pour son propre
  // perimetre ; seule la Mairie Centrale peut enregistrer une recette
  // centrale (arrondissementId = null), conformement a la hierarchie exigee.
  if (!actor.hasGlobalScope) {
    if (!input.arrondissementId) throw new ApiError(400, "Arrondissement requis pour une recette locale.");
    if (!canAccessArrondissement(actor, input.arrondissementId)) {
      throw new ApiError(403, "Arrondissement hors de votre perimetre.");
    }
  }

  const created = await prisma.payment.create({
    data: {
      receiptNumber: generateRecordNumber("QUI"),
      payerId: input.payerId,
      amount: input.amount,
      paymentMethod: input.paymentMethod.trim(),
      taxTypeId: input.taxTypeId || null,
      businessId: input.businessId || null,
      marketStallId: input.marketStallId || null,
      arrondissementId: input.arrondissementId || null,
      collectedById: actor.id,
    },
    include: { taxType: true },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "payments",
    entityType: "Payment",
    entityId: created.id,
    newValue: { receiptNumber: created.receiptNumber, amount: created.amount },
  });

  return created;
}

// Vision consolidee des recettes (section "Dashboard du maire" / correction
// finances). Le total n'est JAMAIS code en dur : toujours recalcule par
// agregation SQL au moment de la requete, filtree par recordScopeWhere().
//   - Mairie Centrale (hasGlobalScope) : total ville + repartition par
//     arrondissement (y compris les recettes centrales, arrondissementId=null).
//   - Arrondissement : uniquement le total et la repartition par type de
//     taxe de son propre perimetre (jamais les autres arrondissements).
export async function getFinanceSummary(user: CurrentUser) {
  const scopeWhere = { ...recordScopeWhere(user), status: "PAID" as const };

  const [totalAgg, byArrondissement, byTaxType] = await Promise.all([
    prisma.payment.aggregate({ where: scopeWhere, _sum: { amount: true } }),
    user.hasGlobalScope
      ? prisma.payment.groupBy({ by: ["arrondissementId"], where: scopeWhere, _sum: { amount: true } })
      : Promise.resolve([]),
    prisma.payment.groupBy({ by: ["taxTypeId"], where: scopeWhere, _sum: { amount: true } }),
  ]);

  let arrondissementBreakdown: { arrondissementId: string | null; name: string; total: number }[] = [];
  if (user.hasGlobalScope) {
    const arrondissements = await prisma.arrondissement.findMany({ select: { id: true, name: true } });
    const byId = new Map(arrondissements.map((a) => [a.id, a.name]));
    arrondissementBreakdown = byArrondissement.map((row) => ({
      arrondissementId: row.arrondissementId,
      name: row.arrondissementId ? byId.get(row.arrondissementId) ?? "Inconnu" : "Mairie Centrale",
      total: row._sum.amount ?? 0,
    }));
  }

  const taxTypeIds = byTaxType.map((r) => r.taxTypeId).filter((id): id is string => id !== null);
  const taxTypes = taxTypeIds.length
    ? await prisma.taxType.findMany({ where: { id: { in: taxTypeIds } }, select: { id: true, name: true } })
    : [];
  const taxTypeById = new Map(taxTypes.map((t) => [t.id, t.name]));
  const taxTypeBreakdown = byTaxType.map((row) => ({
    taxTypeId: row.taxTypeId,
    name: row.taxTypeId ? taxTypeById.get(row.taxTypeId) ?? "Autre" : "Non categorise",
    total: row._sum.amount ?? 0,
  }));

  return {
    total: totalAgg._sum.amount ?? 0,
    arrondissementBreakdown,
    taxTypeBreakdown,
  };
}
