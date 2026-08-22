import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api";
import { can, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateReceiptNumber, generateVerificationToken } from "@/lib/ids";

// Genere le reçu officiel pour un paiement (section 18), appele DANS la
// meme transaction que la creation du Payment (voir services/payments.ts) —
// un paiement valide sans reçu ne doit jamais exister. `sequence` est
// attribue par Postgres (compteur monotone, jamais reutilise) et sert a
// formatter `number` (REC-<annee>-<8 chiffres>).
export async function generateReceiptForPayment(tx: Prisma.TransactionClient, paymentId: string) {
  const row = await tx.receipt.create({
    data: { paymentId, qrToken: generateVerificationToken(), number: "" },
  });
  const number = generateReceiptNumber(row.sequence);
  return tx.receipt.update({ where: { id: row.id }, data: { number } });
}

export async function listReceipts(user: CurrentUser) {
  return prisma.receipt.findMany({
    where: { payment: { arrondissementId: user.hasGlobalScope ? undefined : { in: user.arrondissementIds } } },
    include: { payment: { include: { payer: true, arrondissement: true, taxType: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getReceipt(user: CurrentUser, id: string) {
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: { payment: { include: { payer: true, arrondissement: true, taxType: true, business: true, marketStall: { include: { market: true } } } } },
  });
  if (!receipt) throw new ApiError(404, "Recu introuvable.");
  if (receipt.payment.arrondissementId && !canAccessArrondissement(user, receipt.payment.arrondissementId)) {
    throw new ApiError(403, "Hors de votre perimetre.");
  }
  if (!receipt.payment.arrondissementId && !user.hasGlobalScope) {
    throw new ApiError(403, "Hors de votre perimetre.");
  }
  return receipt;
}

// Image QR encodant l'URL de verification publique (/verify-receipt/<token>),
// generee a la volee (jamais stockee en base — seul le token l'est).
export async function generateReceiptQrPng(qrToken: string, baseUrl: string) {
  const url = `${baseUrl}/verify-receipt/${qrToken}`;
  return QRCode.toBuffer(url, { type: "png", margin: 1, width: 300 });
}

// Annulation d'un reçu (regle absolue #2 : jamais reutilise — le numero et
// le token restent attribues a jamais, seul le statut change).
export async function voidReceipt(actor: CurrentUser, id: string, reason: string) {
  if (!can(actor, "receipts", "cancel")) throw new ApiError(403, "Permission insuffisante.");
  if (!reason?.trim()) throw new ApiError(400, "Un motif est requis.");
  const receipt = await prisma.receipt.findUnique({ where: { id }, include: { payment: true } });
  if (!receipt) throw new ApiError(404, "Recu introuvable.");
  if (receipt.payment.arrondissementId && !canAccessArrondissement(actor, receipt.payment.arrondissementId)) {
    throw new ApiError(403, "Hors de votre perimetre.");
  }
  if (receipt.status === "ANNULE") throw new ApiError(400, "Ce recu est deja annule.");

  const updated = await prisma.receipt.update({
    where: { id },
    data: { status: "ANNULE", voidedAt: new Date(), voidedById: actor.id, voidReason: reason.trim() },
  });

  await logAudit({
    user: actor,
    action: "RECEIPT_VOID",
    module: "receipts",
    entityType: "Receipt",
    entityId: id,
    arrondissementId: receipt.payment.arrondissementId,
    oldValue: { status: receipt.status },
    newValue: { status: updated.status, reason },
  });
  return updated;
}

// Verification PUBLIQUE (section 19) : aucune authentification requise,
// aucune donnee personnelle (jamais le nom du contribuable) — meme regle
// que verifyCertificatePublic().
export async function verifyReceiptPublic(qrTokenOrNumber: string) {
  const receipt = await prisma.receipt.findFirst({
    where: { OR: [{ qrToken: qrTokenOrNumber }, { number: qrTokenOrNumber }] },
    include: { payment: true },
  });
  if (!receipt) return { found: false as const };

  return {
    found: true as const,
    valid: receipt.status === "VALIDE",
    status: receipt.status,
    number: receipt.number,
    amount: receipt.payment.amount,
    paymentDate: receipt.payment.paymentDate,
    paymentMethod: receipt.payment.paymentMethod,
    authority: "Mairie de N'Djamena",
  };
}
