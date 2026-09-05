import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";
import { withBalance } from "@/lib/services/obligations";
import { getPaymentProvider } from "@/lib/services/payment-provider";

// Paiement anonyme depuis un scan QR public (module paiement QR, section
// 41) — aucun compte citoyen requis. Le payeur legal reste le proprietaire
// DEJA enregistre de l'entite (Business.ownerId / MarketStall.occupantId) :
// scanner et payer ne demande jamais au passant de s'authentifier, seule la
// facture de l'entite est reglee. Reutilise integralement le meme pipeline
// que initiateOnlinePayment() (meme PaymentProvider, meme callback
// idempotent/verifie server-to-server, meme generation de reçu — voir
// handlePaymentCallback() dans online-payments.ts, qui traite ce paiement
// sans aucune modification puisqu'il ne discrimine jamais par channel) —
// seule la resolution du payeur differe d'un paiement portail.
export async function initiateQrPayment(
  token: string,
  input: { obligationId: string; providerCode: string; phoneNumber?: string },
) {
  const qr = await prisma.qrCode.findUnique({ where: { token } });
  if (!qr || qr.status !== "ACTIVE") throw new ApiError(404, "QR invalide ou introuvable.");

  const obligation = await prisma.obligationPaiement.findUnique({ where: { id: input.obligationId } });
  if (!obligation) throw new ApiError(404, "Facture introuvable.");

  // L'obligation doit appartenir a L'ENTITE de ce QR precis — jamais faire
  // confiance a un obligationId fourni par le client sans le rattacher au
  // token effectivement scanne (une facture d'une autre boutique ne peut
  // jamais etre reglee via ce QR).
  const belongsToEntity =
    (qr.entityType === "BUSINESS" && obligation.businessId === qr.entityId) ||
    (qr.entityType === "MARKET_STALL" && obligation.marketStallId === qr.entityId);
  if (!belongsToEntity) throw new ApiError(404, "Facture introuvable pour cet emplacement.");

  if (obligation.status === "ANNULE") throw new ApiError(400, "Cette facture est annulee.");
  if (obligation.status === "PAYE") throw new ApiError(400, "Cette facture est deja soldee.");
  const { balance } = withBalance(obligation);
  if (balance <= 0) throw new ApiError(400, "Aucun solde restant a payer.");

  let payerId: string;
  let payerName: string;
  if (qr.entityType === "BUSINESS") {
    const business = await prisma.business.findUnique({ where: { id: qr.entityId }, include: { owner: true } });
    if (!business) throw new ApiError(404, "Commerce introuvable.");
    payerId = business.ownerId;
    payerName = `${business.owner.firstName} ${business.owner.lastName}`;
  } else {
    const stall = await prisma.marketStall.findUnique({ where: { id: qr.entityId }, include: { occupant: true } });
    if (!stall?.occupantId || !stall.occupant) throw new ApiError(400, "Cet emplacement n'a pas d'occupant enregistre.");
    payerId = stall.occupantId;
    payerName = `${stall.occupant.firstName} ${stall.occupant.lastName}`;
  }

  const provider = getPaymentProvider(input.providerCode);
  const internalReference = generateRecordNumber("TXN");

  const payment = await prisma.payment.create({
    data: {
      receiptNumber: generateRecordNumber("QUI"),
      payerId,
      amount: balance,
      paymentMethod: "EN_LIGNE",
      businessId: obligation.businessId,
      marketStallId: obligation.marketStallId,
      obligationId: obligation.id,
      arrondissementId: obligation.arrondissementId,
      collectedById: null, // paiement QR anonyme — aucun acteur identifie ne collecte
      status: "PENDING",
    },
  });

  const initResult = await provider.initializePayment({
    internalReference,
    amount: balance,
    currency: "XAF",
    phoneNumber: input.phoneNumber ?? null,
    payerName,
    description: `Facture ${obligation.number} — ${obligation.period}`,
  });

  const transaction = await prisma.mobileMoneyTransaction.create({
    data: {
      paymentId: payment.id,
      provider: provider.code,
      channel: "QR",
      internalReference,
      externalReference: initResult.providerTransactionId,
      phoneNumber: input.phoneNumber,
      amount: balance,
      currency: "XAF",
      status: "INITIATED",
      providerResponse: (initResult.raw ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  await prisma.qrCodeEvent.create({
    data: { qrCodeId: qr.id, event: "PAYMENT_INITIATED", metadata: { paymentId: payment.id, amount: balance } as Prisma.InputJsonValue },
  });

  // user: null — meme convention que initiateOnlinePayment() : aucun agent
  // n'initie ce paiement, l'identite de l'acteur (le passant anonyme, non
  // identifiable) ne peut pas etre tracee dans AuditLog.userId.
  await logAudit({
    user: null,
    action: "INITIATE_PAYMENT",
    module: "payments",
    entityType: "Payment",
    entityId: payment.id,
    arrondissementId: obligation.arrondissementId,
    newValue: { obligationId: obligation.id, amount: balance, provider: provider.code, internalReference, channel: "QR", qrCodeId: qr.id },
  });

  return { payment, transaction, redirectUrl: initResult.redirectUrl };
}
