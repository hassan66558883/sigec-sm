import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";
import { withBalance, applyPaymentToObligation } from "@/lib/services/obligations";
import { generateReceiptForPayment } from "@/lib/services/receipts";
import { raiseDuplicateAlert } from "@/lib/services/fraud";
import { getPaymentProvider } from "@/lib/services/payment-provider";
import { sendSms } from "@/lib/services/sms";

type CitizenAccountWithCitizen = {
  id: string;
  citizenId: string;
  citizen: { firstName: string; lastName: string; phone: string | null; arrondissementId: string };
};

// Flux paiement en ligne — portail contribuable (module paiement en ligne,
// section 6/7/9). Le contribuable ne voit et n'agit QUE sur ses propres
// obligations : chaque fonction verifie citizenId === account.citizenId,
// jamais de confiance dans un ID fourni par le client.

export async function listMyObligations(account: CitizenAccountWithCitizen) {
  const rows = await prisma.obligationPaiement.findMany({
    where: { citizenId: account.citizenId },
    include: { tarif: true, business: true, marketStall: { include: { market: true } }, arrondissement: true },
    orderBy: { dueDate: "desc" },
    take: 200,
  });
  return rows.map(withBalance);
}

export async function getMyObligation(account: CitizenAccountWithCitizen, id: string) {
  const row = await prisma.obligationPaiement.findUnique({
    where: { id },
    include: { tarif: true, business: true, marketStall: { include: { market: true } }, arrondissement: true, payments: true },
  });
  if (!row || row.citizenId !== account.citizenId) throw new ApiError(404, "Facture introuvable.");
  return withBalance(row);
}

export async function listMyPayments(account: CitizenAccountWithCitizen) {
  return prisma.payment.findMany({
    where: { payerId: account.citizenId },
    include: { receipt: true, obligation: true, mobileMoney: true, arrondissement: true },
    orderBy: { paymentDate: "desc" },
    take: 200,
  });
}

// Initie un paiement en ligne (section 9 : contribuable -> selectionne une
// facture -> "PAYER" -> transaction -> redirection -> paiement). Le montant
// est TOUJOURS le solde reel de l'obligation, jamais une saisie libre.
// Paiement partiel desactive pour ce canal tant qu'aucun texte officiel ne
// l'autorise explicitement pour le paiement en ligne (regle absolue : ne
// jamais inventer une regle) — le paiement physique partiel existant (agent
// guichet) n'est pas touche.
export async function initiateOnlinePayment(
  account: CitizenAccountWithCitizen,
  input: { obligationId: string; providerCode: string; phoneNumber?: string },
) {
  const obligation = await prisma.obligationPaiement.findUnique({ where: { id: input.obligationId } });
  if (!obligation || obligation.citizenId !== account.citizenId) throw new ApiError(404, "Facture introuvable.");
  if (obligation.status === "ANNULE") throw new ApiError(400, "Cette facture est annulee.");
  if (obligation.status === "PAYE") throw new ApiError(400, "Cette facture est deja soldee.");
  const { balance } = withBalance(obligation);
  if (balance <= 0) throw new ApiError(400, "Aucun solde restant a payer.");

  const provider = getPaymentProvider(input.providerCode);
  const internalReference = generateRecordNumber("TXN");

  const payment = await prisma.payment.create({
    data: {
      receiptNumber: generateRecordNumber("QUI"),
      payerId: account.citizenId,
      amount: balance,
      paymentMethod: "EN_LIGNE",
      businessId: obligation.businessId,
      marketStallId: obligation.marketStallId,
      obligationId: obligation.id,
      arrondissementId: obligation.arrondissementId,
      collectedById: account.id, // paiement self-service : pas d'agent, voir commentaire schema.prisma
      status: "PENDING",
    },
  });

  const initResult = await provider.initializePayment({
    internalReference,
    amount: balance,
    currency: "XAF",
    phoneNumber: input.phoneNumber ?? account.citizen.phone,
    payerName: `${account.citizen.firstName} ${account.citizen.lastName}`,
    description: `Facture ${obligation.number} — ${obligation.period}`,
  });

  const transaction = await prisma.mobileMoneyTransaction.create({
    data: {
      paymentId: payment.id,
      provider: provider.code,
      channel: "ONLINE",
      internalReference,
      externalReference: initResult.providerTransactionId,
      phoneNumber: input.phoneNumber ?? account.citizen.phone,
      amount: balance,
      currency: "XAF",
      status: "INITIATED",
      providerResponse: (initResult.raw ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  // user: null — AuditLog.userId est une FK reelle vers User (comptes
  // agents/staff) ; un CitizenAccount n'y correspond pas. L'identite du
  // contribuable est conservee dans newValue plutot que dans userId/userName.
  await logAudit({
    user: null,
    action: "INITIATE_PAYMENT",
    module: "payments",
    entityType: "Payment",
    entityId: payment.id,
    arrondissementId: obligation.arrondissementId,
    newValue: {
      obligationId: obligation.id,
      amount: balance,
      provider: provider.code,
      internalReference,
      initiatedByCitizenAccountId: account.id,
      initiatedByName: `${account.citizen.firstName} ${account.citizen.lastName} (portail)`,
    },
  });

  return { payment, transaction, redirectUrl: initResult.redirectUrl };
}

// Callback prestataire (section 9/11) : point d'entree UNIQUE par lequel un
// paiement en ligne devient PAID. Idempotent — un callback redelivre pour
// une transaction deja traitee ne reimpute jamais l'obligation ni ne
// regenere de reçu. Ne leve jamais d'exception pour une charge utile/
// signature invalide (retournee via provider.handleCallback() -> null) afin
// d'eviter les re-livraisons infinies d'un prestataire reel.
export async function handlePaymentCallback(providerCode: string, rawPayload: unknown, headers: Record<string, string>) {
  const provider = getPaymentProvider(providerCode);
  const parsed = await provider.handleCallback(rawPayload, headers);
  if (!parsed) return { ok: false as const, reason: "Charge utile invalide." };

  const transaction = await prisma.mobileMoneyTransaction.findUnique({
    where: { internalReference: parsed.internalReference },
    include: { payment: true },
  });
  if (!transaction) return { ok: false as const, reason: "Transaction inconnue." };

  // Idempotence : callback deja traite, on ne rejoue rien.
  if (transaction.status === "SUCCESS" || transaction.status === "FAILED") {
    return { ok: true as const, alreadyProcessed: true };
  }

  // externalReference est UNIQUE en base : une collision ici signifie qu'un
  // prestataire revendique la meme reference pour deux transactions
  // distinctes — une anomalie a journaliser comme telle (regle absolue #5),
  // jamais une exception qui remonterait au webhook.
  try {
    await prisma.mobileMoneyTransaction.update({
      where: { id: transaction.id },
      data: { callbackReceivedAt: new Date(), externalReference: transaction.externalReference ?? parsed.providerTransactionId },
    });
  } catch {
    await raiseDuplicateAlert(
      "DOUBLE_PAYMENT",
      `Reference prestataire ${parsed.providerTransactionId} deja associee a une autre transaction.`,
      transaction.payment.arrondissementId,
    );
    return { ok: true as const, alreadyProcessed: false, status: "FAILED" as const };
  }

  if (parsed.status === "FAILED") {
    await prisma.$transaction([
      prisma.mobileMoneyTransaction.update({ where: { id: transaction.id }, data: { status: "FAILED", failureReason: "Rejet prestataire." } }),
      prisma.payment.update({ where: { id: transaction.paymentId }, data: { status: "ECHEC" } }),
    ]);
    await logAudit({
      user: null,
      action: "PAYMENT_FAILED",
      module: "payments",
      entityType: "Payment",
      entityId: transaction.paymentId,
      arrondissementId: transaction.payment.arrondissementId,
      newValue: { transactionId: transaction.id },
      result: "FAILURE",
    });
    return { ok: true as const, alreadyProcessed: false, status: "FAILED" as const };
  }

  // Verification obligatoire aupres du prestataire AVANT tout passage a PAID
  // (regle critique de securite, section 10) — jamais un agent ni un
  // callback seul ne peut faire passer un paiement en PAID.
  const verified = await provider.verifyTransaction({
    providerTransactionId: parsed.providerTransactionId,
    expectedAmount: transaction.amount,
  });
  if (!verified || parsed.amount !== transaction.amount) {
    await prisma.$transaction([
      prisma.mobileMoneyTransaction.update({
        where: { id: transaction.id },
        data: { status: "FAILED", failureReason: "Verification prestataire echouee ou montant incoherent." },
      }),
      prisma.payment.update({ where: { id: transaction.paymentId }, data: { status: "ECHEC" } }),
    ]);
    await raiseDuplicateAlert(
      "FORBIDDEN_MODIFICATION",
      `Callback de paiement non verifie ou montant incoherent (transaction ${transaction.id}).`,
      transaction.payment.arrondissementId,
    );
    await logAudit({
      user: null,
      action: "PAYMENT_FAILED",
      module: "payments",
      entityType: "Payment",
      entityId: transaction.paymentId,
      arrondissementId: transaction.payment.arrondissementId,
      newValue: { transactionId: transaction.id, reason: "verification_failed" },
      result: "FAILURE",
    });
    return { ok: true as const, alreadyProcessed: false, status: "FAILED" as const };
  }

  const { receipt } = await prisma.$transaction(async (tx) => {
    await tx.mobileMoneyTransaction.update({
      where: { id: transaction.id },
      data: { status: "SUCCESS", verifiedAt: new Date(), confirmedAt: new Date() },
    });
    await tx.payment.update({ where: { id: transaction.paymentId }, data: { status: "PAID" } });
    if (transaction.payment.obligationId) {
      await applyPaymentToObligation(tx, transaction.payment.obligationId, transaction.payment.amount);
    }
    const receipt = await generateReceiptForPayment(tx, transaction.paymentId);
    return { receipt };
  });

  await logAudit({
    user: null,
    action: "PAYMENT_CONFIRMED",
    module: "payments",
    entityType: "Payment",
    entityId: transaction.paymentId,
    arrondissementId: transaction.payment.arrondissementId,
    newValue: { transactionId: transaction.id, receiptId: receipt.id },
  });
  await logAudit({
    user: null,
    action: "RECEIPT_GENERATION",
    module: "receipts",
    entityType: "Receipt",
    entityId: receipt.id,
    arrondissementId: transaction.payment.arrondissementId,
    newValue: { number: receipt.number, paymentId: transaction.paymentId },
  });

  const citizenAccount = await prisma.citizenAccount.findUnique({ where: { citizenId: transaction.payment.payerId } });
  if (citizenAccount) {
    await prisma.notification.create({
      data: {
        citizenAccountId: citizenAccount.id,
        title: "Paiement confirme",
        message: `Votre paiement de ${transaction.amount} FCFA a ete confirme. Reference : ${transaction.internalReference}. Votre reçu electronique (${receipt.number}) est disponible dans votre espace SIGEC-SM.`,
      },
    });
    const citizen = await prisma.citizen.findUnique({ where: { id: transaction.payment.payerId } });
    if (citizen?.phone) {
      await sendSms(citizen.phone, `Votre paiement de ${transaction.amount} FCFA a ete confirme. Reference : ${transaction.internalReference}.`);
    }
  }

  return { ok: true as const, alreadyProcessed: false, status: "SUCCESS" as const, receipt };
}
