import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import type { RecordPaymentInput } from "@/lib/services/payments";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";
import { applyPaymentToObligation } from "@/lib/services/obligations";
import { generateReceiptForPayment } from "@/lib/services/receipts";
import { raiseDuplicateAlert } from "@/lib/services/fraud";

type PaymentContext = {
  arrondissementId: string | null;
  businessId: string | null;
  marketStallId: string | null;
  agentId: string | null;
  caisseId: string | null;
};

// Architecture Mobile Money (section 17) : SIGEC-SM -> Payment Service ->
// Provider/Passerelle -> Operateur -> Confirmation -> SIGEC-SM -> Reçu.
// Aucun prestataire n'a ete effectivement contractualise a ce stade : le
// `provider` reste configurable ("MANUAL" par defaut) et AUCUNE confirmation
// n'est simulee automatiquement. Le paiement est cree PENDING ; seule une
// action explicite (aujourd'hui : confirmMobileMoneyPayment(), demain :
// le webhook d'un vrai prestataire appelant la meme fonction) le fait
// passer PAID + genere le reçu. externalReference est UNIQUE en base :
// c'est le mecanisme d'idempotence (regle absolue #5).
export async function initiateMobileMoneyPayment(actor: CurrentUser, input: RecordPaymentInput, context: PaymentContext) {
  if (!input.phoneNumber?.trim()) throw new ApiError(400, "Numero de telephone Mobile Money requis.");
  if (!input.externalReference?.trim()) {
    throw new ApiError(400, "Reference de transaction du prestataire requise (idempotence).");
  }

  const existing = await prisma.mobileMoneyTransaction.findUnique({ where: { externalReference: input.externalReference.trim() } });
  if (existing) {
    await raiseDuplicateAlert(
      "DOUBLE_PAYMENT",
      `Tentative de reutilisation de la reference Mobile Money ${input.externalReference.trim()}.`,
      context.arrondissementId,
    );
    throw new ApiError(409, "Cette reference de transaction a deja ete enregistree.");
  }

  const payment = await prisma.payment.create({
    data: {
      receiptNumber: generateRecordNumber("QUI"),
      payerId: input.payerId,
      amount: input.amount,
      paymentMethod: "MOBILE_MONEY",
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
      status: "PENDING",
    },
  });

  const transaction = await prisma.mobileMoneyTransaction.create({
    data: {
      paymentId: payment.id,
      phoneNumber: input.phoneNumber.trim(),
      externalReference: input.externalReference.trim(),
      amount: input.amount,
      status: "INITIATED",
    },
  });

  await logAudit({
    user: actor,
    action: "MOBILE_MONEY_INITIATED",
    module: "mobile_money",
    entityType: "MobileMoneyTransaction",
    entityId: transaction.id,
    arrondissementId: context.arrondissementId,
    newValue: { paymentId: payment.id, externalReference: transaction.externalReference, amount: input.amount },
  });

  return { ...payment, mobileMoney: transaction, receipt: null as null };
}

export async function listMobileMoneyTransactions(user: CurrentUser, status?: string) {
  return prisma.mobileMoneyTransaction.findMany({
    where: {
      payment: recordScopeWhere(user),
      ...(status ? { status } : {}),
    },
    include: { payment: { include: { payer: true, arrondissement: true } } },
    orderBy: { initiatedAt: "desc" },
    take: 200,
  });
}

// Confirmation reelle (section 17) : c'est ICI, et seulement ici, qu'un
// paiement Mobile Money devient PAID — impute l'obligation et genere le
// reçu, exactement comme un paiement especes, mais uniquement une fois la
// transaction confirmee. En l'absence de prestataire integre, cette action
// est declenchee manuellement par un agent autorise (`mobile_money:confirm`)
// qui a verifie la reception aupres du contribuable/de l'operateur — jamais
// automatique.
export async function confirmMobileMoneyPayment(actor: CurrentUser, transactionId: string) {
  if (!can(actor, "mobile_money", "confirm")) throw new ApiError(403, "Permission insuffisante.");
  const transaction = await prisma.mobileMoneyTransaction.findUnique({ where: { id: transactionId }, include: { payment: true } });
  if (!transaction) throw new ApiError(404, "Transaction introuvable.");
  if (transaction.payment.arrondissementId && !canAccessArrondissement(actor, transaction.payment.arrondissementId)) {
    throw new ApiError(403, "Hors de votre perimetre.");
  }
  if (transaction.status !== "INITIATED" && transaction.status !== "PENDING") {
    throw new ApiError(400, "Cette transaction n'est plus en attente de confirmation.");
  }

  const { receipt } = await prisma.$transaction(async (tx) => {
    await tx.mobileMoneyTransaction.update({
      where: { id: transactionId },
      data: { status: "SUCCESS", confirmedAt: new Date(), confirmedById: actor.id },
    });
    await tx.payment.update({ where: { id: transaction.paymentId }, data: { status: "PAID" } });

    if (transaction.payment.obligationId) {
      await applyPaymentToObligation(tx, transaction.payment.obligationId, transaction.payment.amount);
    }
    const receipt = await generateReceiptForPayment(tx, transaction.paymentId);
    return { receipt };
  });

  await logAudit({
    user: actor,
    action: "MOBILE_MONEY_CONFIRMED",
    module: "mobile_money",
    entityType: "MobileMoneyTransaction",
    entityId: transactionId,
    arrondissementId: transaction.payment.arrondissementId,
    newValue: { status: "SUCCESS", receiptId: receipt.id },
  });
  await logAudit({
    user: actor,
    action: "RECEIPT_GENERATION",
    module: "receipts",
    entityType: "Receipt",
    entityId: receipt.id,
    arrondissementId: transaction.payment.arrondissementId,
    newValue: { number: receipt.number, paymentId: transaction.paymentId },
  });

  return receipt;
}

export async function failMobileMoneyPayment(actor: CurrentUser, transactionId: string, reason: string) {
  if (!can(actor, "mobile_money", "confirm")) throw new ApiError(403, "Permission insuffisante.");
  if (!reason?.trim()) throw new ApiError(400, "Un motif est requis.");
  const transaction = await prisma.mobileMoneyTransaction.findUnique({ where: { id: transactionId }, include: { payment: true } });
  if (!transaction) throw new ApiError(404, "Transaction introuvable.");
  if (transaction.payment.arrondissementId && !canAccessArrondissement(actor, transaction.payment.arrondissementId)) {
    throw new ApiError(403, "Hors de votre perimetre.");
  }
  if (transaction.status !== "INITIATED" && transaction.status !== "PENDING") {
    throw new ApiError(400, "Cette transaction n'est plus en attente.");
  }

  await prisma.$transaction([
    prisma.mobileMoneyTransaction.update({ where: { id: transactionId }, data: { status: "FAILED" } }),
    prisma.payment.update({ where: { id: transaction.paymentId }, data: { status: "ECHEC" } }),
  ]);

  await logAudit({
    user: actor,
    action: "MOBILE_MONEY_FAILED",
    module: "mobile_money",
    entityType: "MobileMoneyTransaction",
    entityId: transactionId,
    arrondissementId: transaction.payment.arrondissementId,
    newValue: { status: "FAILED", reason },
    result: "FAILURE",
  });
}
