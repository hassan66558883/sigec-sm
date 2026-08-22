import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { reversePaymentOnObligation } from "@/lib/services/obligations";
import { getPaymentProvider } from "@/lib/services/payment-provider";

// Remboursement d'un paiement confirme (module paiement en ligne, section
// 8/17). Le Payment original n'est jamais supprime ni modifie autrement que
// son statut : la regle absolue "jamais de suppression, motif obligatoire,
// journalise" s'applique ici exactement comme a l'annulation.
export async function refundPayment(actor: CurrentUser, paymentId: string, reason: string, amount?: number) {
  if (!can(actor, "payments", "refund")) throw new ApiError(403, "Permission insuffisante.");
  if (!reason?.trim()) throw new ApiError(400, "Un motif est requis.");

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { mobileMoney: true, refund: true },
  });
  if (!payment) throw new ApiError(404, "Paiement introuvable.");
  if (payment.arrondissementId && !canAccessArrondissement(actor, payment.arrondissementId)) {
    throw new ApiError(403, "Hors de votre perimetre.");
  }
  if (payment.status !== "PAID") throw new ApiError(400, "Seul un paiement confirme (PAID) peut etre rembourse.");
  if (payment.refund) throw new ApiError(400, "Ce paiement a deja fait l'objet d'un remboursement.");

  const refundAmount = amount ?? payment.amount;
  if (refundAmount <= 0 || refundAmount > payment.amount) throw new ApiError(400, "Montant de remboursement invalide.");

  let providerReference: string | null = null;
  if (payment.mobileMoney) {
    const provider = getPaymentProvider(payment.mobileMoney.provider);
    const externalRef = payment.mobileMoney.externalReference;
    if (externalRef) {
      const result = await provider.refundPayment({ providerTransactionId: externalRef, amount: refundAmount, reason: reason.trim() });
      providerReference = result.providerReference;
    }
  }

  const { refund } = await prisma.$transaction(async (tx) => {
    const refund = await tx.paymentRefund.create({
      data: {
        paymentId: payment.id,
        amount: refundAmount,
        reason: reason.trim(),
        status: "COMPLETED",
        providerReference,
        requestedById: actor.id,
        completedAt: new Date(),
      },
    });
    await tx.payment.update({ where: { id: payment.id }, data: { status: "REMBOURSE" } });
    if (payment.obligationId) {
      await reversePaymentOnObligation(tx, payment.obligationId, refundAmount);
    }
    if (payment.mobileMoney) {
      await tx.mobileMoneyTransaction.update({ where: { id: payment.mobileMoney.id }, data: { status: "REFUNDED" } });
    }
    return { refund };
  });

  await logAudit({
    user: actor,
    action: "REFUND",
    module: "payments",
    entityType: "Payment",
    entityId: payment.id,
    arrondissementId: payment.arrondissementId,
    oldValue: { status: payment.status },
    newValue: { status: "REMBOURSE", amount: refundAmount, reason, refundId: refund.id },
  });

  return refund;
}

export async function listRefunds(user: CurrentUser) {
  return prisma.paymentRefund.findMany({
    where: { payment: { arrondissementId: user.hasGlobalScope ? undefined : { in: user.arrondissementIds } } },
    include: { payment: { include: { payer: true, arrondissement: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
