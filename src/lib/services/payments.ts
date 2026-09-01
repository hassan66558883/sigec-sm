import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { scopeSql } from "@/lib/rbac-sql";
import { monthBuckets, monthKey } from "@/lib/date-buckets";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";
import { applyPaymentToObligation } from "@/lib/services/obligations";
import { generateReceiptForPayment } from "@/lib/services/receipts";
import { initiateMobileMoneyPayment } from "@/lib/services/mobile-money";
import { detectExcessiveCancellations, detectOutOfZone, detectSuspiciousVolume, detectOffHours, enforceGeolocationPolicy } from "@/lib/services/fraud";

export async function listTaxTypes() {
  return prisma.taxType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function listPayments(user: CurrentUser) {
  return prisma.payment.findMany({
    where: recordScopeWhere(user),
    include: { payer: true, taxType: true, business: true, marketStall: { include: { market: true } }, arrondissement: true, agent: true, receipt: true },
    orderBy: { paymentDate: "desc" },
    take: 100,
  });
}

export type PaymentReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  arrondissementId?: string;
  agentId?: string;
  paymentMethod?: string;
  status?: string;
};

// Rapport recettes filtre (section 31) : les memes filtres croises que
// demandes (periode, arrondissement, agent, mode de paiement, statut),
// toujours borne par recordScopeWhere() — un compte arrondissement ne peut
// jamais elargir son perimetre via `arrondissementId` (l'appelant est
// simplement ignore hors de son propre scope).
export async function listPaymentsForReport(user: CurrentUser, filters: PaymentReportFilters) {
  const scope = recordScopeWhere(user);
  const arrondissementFilter =
    filters.arrondissementId && (user.hasGlobalScope || user.arrondissementIds.includes(filters.arrondissementId))
      ? { arrondissementId: filters.arrondissementId }
      : {};

  return prisma.payment.findMany({
    where: {
      ...scope,
      ...arrondissementFilter,
      ...(filters.agentId ? { agentId: filters.agentId } : {}),
      ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            paymentDate: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59`) } : {}),
            },
          }
        : {}),
    },
    include: { payer: true, taxType: true, business: true, marketStall: { include: { market: true } }, arrondissement: true, agent: { include: { user: true } } },
    orderBy: { paymentDate: "desc" },
    take: 5000,
  });
}

export async function listCancellations(user: CurrentUser) {
  return prisma.paymentCancellation.findMany({
    where: { payment: recordScopeWhere(user) },
    include: { payment: { include: { payer: true, arrondissement: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export type RecordPaymentInput = {
  payerId: string;
  amount: number;
  paymentMethod: string;
  taxTypeId?: string | null;
  businessId?: string | null;
  marketStallId?: string | null;
  obligationId?: string | null;
  agentId?: string | null;
  caisseId?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  arrondissementId?: string | null; // null = recette Mairie Centrale (reserve aux comptes CENTRAL)
  // Requis uniquement si paymentMethod === "MOBILE_MONEY" (section 17).
  phoneNumber?: string;
  externalReference?: string;
};

// Resout et valide le perimetre/l'emplacement communs a tous les modes de
// paiement (obligation, arrondissement, agent, caisse) — partage entre le
// flux immediat (especes/virement) et le flux Mobile Money (differe).
async function resolvePaymentContext(actor: CurrentUser, input: RecordPaymentInput) {
  let arrondissementId = input.arrondissementId || null;
  let businessId = input.businessId || null;
  let marketStallId = input.marketStallId || null;

  if (input.obligationId) {
    const obligation = await prisma.obligationPaiement.findUnique({ where: { id: input.obligationId } });
    if (!obligation) throw new ApiError(404, "Obligation introuvable.");
    if (obligation.status === "ANNULE" || obligation.status === "PAYE") {
      throw new ApiError(400, "Cette obligation n'accepte plus de paiement (deja soldee ou annulee).");
    }
    if (!canAccessArrondissement(actor, obligation.arrondissementId)) {
      throw new ApiError(403, "Arrondissement hors de votre perimetre.");
    }
    arrondissementId = obligation.arrondissementId;
    businessId = obligation.businessId;
    marketStallId = obligation.marketStallId;
  } else if (!actor.hasGlobalScope) {
    // Un agent d'arrondissement ne peut collecter que pour son propre
    // perimetre ; seule la Mairie Centrale peut enregistrer une recette
    // centrale (arrondissementId = null), conformement a la hierarchie exigee.
    if (!arrondissementId) throw new ApiError(400, "Arrondissement requis pour une recette locale.");
    if (!canAccessArrondissement(actor, arrondissementId)) {
      throw new ApiError(403, "Arrondissement hors de votre perimetre.");
    }
  }

  const agentId = input.agentId || null;
  let caisseId = input.caisseId || null;
  if (agentId) {
    const agent = await prisma.agentCollecteur.findUnique({ where: { id: agentId } });
    if (!agent || agent.status !== "ACTIF") throw new ApiError(400, "Agent collecteur invalide ou inactif.");
    if (!canAccessArrondissement(actor, agent.arrondissementId)) throw new ApiError(403, "Agent hors de votre perimetre.");
    // Rattache automatiquement a la caisse actuellement ouverte de l'agent
    // si aucune n'est precisee explicitement (section 20 : les collectes
    // d'une session de caisse doivent y etre rattachees pour le rapprochement).
    if (!caisseId) {
      const openCaisse = await prisma.cashRegister.findFirst({ where: { agentId, status: "OUVERTE" } });
      caisseId = openCaisse?.id ?? null;
    }
  }

  return { arrondissementId, businessId, marketStallId, agentId, caisseId };
}

// Enregistre une recette et, dans la MEME transaction : impute le montant
// sur l'obligation liee si fournie (jamais de solde incoherent entre les
// deux tables) et genere le reçu officiel (regle absolue : un paiement
// valide sans reçu ne doit jamais exister). Si `obligationId` est fourni,
// l'emplacement/l'arrondissement de l'obligation font foi (l'appelant ne
// peut pas les detourner via le payload).
//
// Cas particulier MOBILE_MONEY (section 17) : delegue entierement a
// initiateMobileMoneyPayment() — le paiement reste PENDING, sans reçu, tant
// que confirmMobileMoneyPayment() n'a pas ete appele (jamais de succes
// simule). Voir services/mobile-money.ts.
export async function recordPayment(actor: CurrentUser, input: RecordPaymentInput) {
  if (!can(actor, "payments", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.payerId) throw new ApiError(400, "Payeur requis.");
  if (!input.amount || input.amount <= 0) throw new ApiError(400, "Montant invalide.");
  if (!input.paymentMethod?.trim()) throw new ApiError(400, "Mode de paiement requis.");

  const context = await resolvePaymentContext(actor, input);

  if (input.paymentMethod.trim() === "MOBILE_MONEY") {
    return initiateMobileMoneyPayment(actor, input, context);
  }

  // Politique de geolocalisation (section 25) : verifiee AVANT toute
  // ecriture — un policy=BLOCK doit empecher la collecte, pas l'annuler
  // apres coup.
  if (context.agentId) {
    await enforceGeolocationPolicy(context.agentId, context.arrondissementId, input.gpsLat, input.gpsLng);
  }

  const { created, receipt } = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        receiptNumber: generateRecordNumber("QUI"),
        payerId: input.payerId,
        amount: input.amount,
        paymentMethod: input.paymentMethod.trim(),
        taxTypeId: input.taxTypeId || null,
        businessId: context.businessId,
        marketStallId: context.marketStallId,
        obligationId: input.obligationId || null,
        agentId: context.agentId,
        caisseId: context.caisseId,
        gpsLat: input.gpsLat ?? null,
        gpsLng: input.gpsLng ?? null,
        arrondissementId: context.arrondissementId,
        collectedById: actor.id,
      },
      include: { taxType: true },
    });

    if (input.obligationId) {
      await applyPaymentToObligation(tx, input.obligationId, input.amount);
    }

    const receipt = await generateReceiptForPayment(tx, payment.id);
    return { created: payment, receipt };
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "payments",
    entityType: "Payment",
    entityId: created.id,
    arrondissementId: created.arrondissementId,
    newValue: { receiptNumber: created.receiptNumber, amount: created.amount },
  });
  await logAudit({
    user: actor,
    action: "RECEIPT_GENERATION",
    module: "receipts",
    entityType: "Receipt",
    entityId: receipt.id,
    arrondissementId: created.arrondissementId,
    newValue: { number: receipt.number, paymentId: created.id },
  });

  // Detecteurs anti-fraude (section 22) : jamais bloquants, executes une
  // fois le paiement effectivement enregistre.
  if (context.agentId) {
    await detectOutOfZone(created.id, context.agentId, undefined, context.marketStallId ? (await prisma.marketStall.findUnique({ where: { id: context.marketStallId } }))?.marketId : null);
    await detectSuspiciousVolume(context.agentId);
    await detectOffHours(created.id, context.agentId, created.paymentDate, created.arrondissementId);
  }

  return { ...created, receipt };
}

// Annulation d'un paiement valide (regles absolues #1 et #6 : jamais de
// suppression, motif toujours obligatoire). Reverse l'imputation sur
// l'obligation liee (sinon elle resterait PAYE/PARTIELLEMENT_PAYE pour un
// paiement qui n'a plus lieu d'etre compte) et annule le reçu associe — le
// Payment original reste visible integralement, seul son statut change.
export async function cancelPayment(actor: CurrentUser, id: string, reason: string) {
  if (!can(actor, "payments", "cancel")) throw new ApiError(403, "Permission insuffisante.");
  if (!reason?.trim()) throw new ApiError(400, "Un motif est requis.");

  const before = await prisma.payment.findUnique({ where: { id }, include: { obligation: true, receipt: true } });
  if (!before) throw new ApiError(404, "Paiement introuvable.");
  if (before.arrondissementId && !canAccessArrondissement(actor, before.arrondissementId)) {
    throw new ApiError(403, "Hors de votre perimetre.");
  }
  if (!before.arrondissementId && !actor.hasGlobalScope) throw new ApiError(403, "Hors de votre perimetre.");
  if (before.status === "ANNULE") throw new ApiError(400, "Ce paiement est deja annule.");

  const updated = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({ where: { id }, data: { status: "ANNULE" } });

    if (before.obligationId && before.obligation) {
      const paidAmount = Math.max(0, before.obligation.paidAmount - before.amount);
      const status = paidAmount <= 0 ? "A_PAYER" : paidAmount >= before.obligation.initialAmount ? "PAYE" : "PARTIELLEMENT_PAYE";
      await tx.obligationPaiement.update({ where: { id: before.obligationId }, data: { paidAmount, status } });
    }

    if (before.receipt) {
      await tx.receipt.update({
        where: { id: before.receipt.id },
        data: { status: "ANNULE", voidedAt: new Date(), voidedById: actor.id, voidReason: reason.trim() },
      });
    }

    await tx.paymentCancellation.create({
      data: { paymentId: id, reason: reason.trim(), cancelledById: actor.id, cancelledByName: actor.name },
    });

    return payment;
  });

  await logAudit({
    user: actor,
    action: "PAYMENT_CANCELLATION",
    module: "payments",
    entityType: "Payment",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status, reason },
  });

  if (before.agentId) await detectExcessiveCancellations(before.agentId);

  return updated;
}

// Vision consolidee des recettes (section "Dashboard du maire" / correction
// finances). Le total n'est JAMAIS code en dur : toujours recalcule par
// agregation SQL au moment de la requete, filtree par recordScopeWhere().
// status: "PAID" exclut automatiquement les paiements ANNULE des totaux.
//   - Mairie Centrale (hasGlobalScope) : total ville + repartition par
//     arrondissement (y compris les recettes centrales, arrondissementId=null).
//   - Arrondissement : uniquement le total et la repartition par type de
//     taxe de son propre perimetre (jamais les autres arrondissements).
export async function getFinanceSummary(user: CurrentUser) {
  const scopeWhere = { ...recordScopeWhere(user), status: "PAID" as const };

  // Bornes de periode toujours recalculees a partir de l'heure serveur
  // actuelle (jamais codees en dur), pour le decoupage jour/mois/annee.
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [totalAgg, byArrondissement, byTaxType, todayAgg, monthAgg, yearAgg] = await Promise.all([
    prisma.payment.aggregate({ where: scopeWhere, _sum: { amount: true } }),
    user.hasGlobalScope
      ? prisma.payment.groupBy({ by: ["arrondissementId"], where: scopeWhere, _sum: { amount: true } })
      : Promise.resolve([]),
    prisma.payment.groupBy({ by: ["taxTypeId"], where: scopeWhere, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { ...scopeWhere, paymentDate: { gte: startOfDay } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { ...scopeWhere, paymentDate: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { ...scopeWhere, paymentDate: { gte: startOfYear } }, _sum: { amount: true } }),
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
    byPeriod: {
      today: todayAgg._sum.amount ?? 0,
      month: monthAgg._sum.amount ?? 0,
      year: yearAgg._sum.amount ?? 0,
    },
    arrondissementBreakdown,
    taxTypeBreakdown,
  };
}

// Tendance des recettes mensuelles (tableau de bord, section 10). Payment
// est deja indexe sur paymentDate — agregation Postgres, pas de
// regroupement cote Node.
export async function getRevenueTrend(user: CurrentUser, months = 12) {
  if (!can(user, "payments", "view")) return [];
  const buckets = monthBuckets(months);
  const since = buckets[0].date;

  const rows = await prisma.$queryRaw<{ bucket: Date; total: number | null }[]>(Prisma.sql`
    SELECT date_trunc('month', "paymentDate") AS bucket, SUM(amount) AS total
    FROM "Payment"
    WHERE status = 'PAID' AND ${scopeSql(user)} AND "paymentDate" >= ${since}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  const byMonth = new Map(rows.map((r) => [monthKey(new Date(r.bucket)), Number(r.total ?? 0)]));
  return buckets.map((b) => ({ month: b.label, recettes: byMonth.get(b.key) ?? 0 }));
}
