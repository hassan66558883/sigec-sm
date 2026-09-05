import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";
import { listProviderCodes } from "@/lib/services/payment-provider";
import { raiseReconciliationDiscrepancy } from "@/lib/services/fraud";

// Rapprochement prestataire/banque (module paiement QR, section 31) —
// distinct de CashRegister/Versement (especes physique uniquement).
// MobileMoneyTransaction.externalReference est deja concu comme la cle
// d'idempotence prestataire (voir mobile-money.ts) : c'est naturellement
// la cle de correspondance avec un releve externe. Aucun montant n'est
// jamais suppose exact sans comparaison explicite (regle absolue : ne
// jamais marquer un rapprochement reussi sans verification reelle, meme
// esprit que la regle §11 sur les paiements).
const AMOUNT_EPSILON = 0.01;

type StatementRow = { externalReference: string; amount: number; date: Date | null };

// Format attendu (documente pour l'utilisateur televersant le fichier) :
// colonnes "reference", "montant" (ou "amount"), "date" (optionnelle) —
// insensible a la casse/aux espaces, ordre libre.
function parseStatementCsv(text: string): StatementRow[] {
  const rows = parseCsv(text);
  const rowsOut: StatementRow[] = [];
  for (const row of rows) {
    const keys = Object.keys(row);
    const refKey = keys.find((k) => /^(reference|externalreference|ref)$/i.test(k));
    const amountKey = keys.find((k) => /^(montant|amount)$/i.test(k));
    const dateKey = keys.find((k) => /^date$/i.test(k));
    const reference = refKey ? row[refKey] : "";
    const amountRaw = amountKey ? row[amountKey] : "";
    if (!reference || !amountRaw) continue;
    const amount = Number(amountRaw.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(amount)) continue;
    const dateRaw = dateKey ? row[dateKey] : "";
    const date = dateRaw ? new Date(dateRaw) : null;
    rowsOut.push({ externalReference: reference, amount, date: date && !isNaN(date.getTime()) ? date : null });
  }
  return rowsOut;
}

export type IngestStatementInput = {
  provider: string;
  periodStart: string;
  periodEnd: string;
  fileName: string;
  csvText: string;
};

export async function ingestReconciliationStatement(actor: CurrentUser, input: IngestStatementInput) {
  if (!can(actor, "reconciliation", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!listProviderCodes().includes(input.provider)) throw new ApiError(400, "Prestataire inconnu.");

  const periodStart = new Date(input.periodStart);
  const periodEnd = new Date(input.periodEnd);
  if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime()) || periodStart > periodEnd) {
    throw new ApiError(400, "Periode invalide.");
  }
  // periodEnd vient d'un <input type="date"> (YYYY-MM-DD, sans heure) —
  // etendre a la fin de journee pour que "periode se terminant aujourd'hui"
  // inclue reellement toute la journee, pas seulement minuit.
  const periodEndInclusive = new Date(periodEnd.getTime());
  periodEndInclusive.setUTCHours(23, 59, 59, 999);

  const statementRows = parseStatementCsv(input.csvText);
  if (statementRows.length === 0) {
    throw new ApiError(400, "Aucune ligne exploitable dans le fichier (colonnes attendues : reference, montant).");
  }

  const internalTransactions = await prisma.mobileMoneyTransaction.findMany({
    where: {
      provider: input.provider,
      status: "SUCCESS",
      confirmedAt: { gte: periodStart, lte: periodEndInclusive },
    },
  });
  const byReference = new Map(internalTransactions.filter((t) => t.externalReference).map((t) => [t.externalReference as string, t]));

  type EntryDraft = {
    externalReference: string | null;
    statementAmount: number | null;
    statementDate: Date | null;
    mobileMoneyTransactionId: string | null;
    status: "MATCHED" | "AMOUNT_MISMATCH" | "MISSING_INTERNAL" | "UNMATCHED_EXTERNAL";
  };
  const drafts: EntryDraft[] = [];

  for (const row of statementRows) {
    const internal = byReference.get(row.externalReference);
    if (!internal) {
      drafts.push({ externalReference: row.externalReference, statementAmount: row.amount, statementDate: row.date, mobileMoneyTransactionId: null, status: "UNMATCHED_EXTERNAL" });
      continue;
    }
    byReference.delete(row.externalReference);
    const matches = Math.abs(internal.amount - row.amount) < AMOUNT_EPSILON;
    drafts.push({
      externalReference: row.externalReference,
      statementAmount: row.amount,
      statementDate: row.date,
      mobileMoneyTransactionId: internal.id,
      status: matches ? "MATCHED" : "AMOUNT_MISMATCH",
    });
  }
  // Transactions internes reussies dans la periode mais absentes du releve.
  for (const internal of byReference.values()) {
    drafts.push({
      externalReference: internal.externalReference,
      statementAmount: null,
      statementDate: null,
      mobileMoneyTransactionId: internal.id,
      status: "MISSING_INTERNAL",
    });
  }

  const matchedCount = drafts.filter((d) => d.status === "MATCHED").length;
  const mismatchCount = drafts.filter((d) => d.status === "AMOUNT_MISMATCH").length;
  const missingInternalCount = drafts.filter((d) => d.status === "MISSING_INTERNAL").length;
  const unmatchedExternalCount = drafts.filter((d) => d.status === "UNMATCHED_EXTERNAL").length;

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.reconciliationBatch.create({
      data: {
        provider: input.provider,
        periodStart,
        periodEnd,
        fileName: input.fileName,
        uploadedById: actor.id,
        matchedCount,
        mismatchCount,
        missingInternalCount,
        unmatchedExternalCount,
      },
    });
    if (drafts.length > 0) {
      await tx.reconciliationEntry.createMany({
        data: drafts.map((d) => ({ ...d, batchId: created.id })),
      });
    }
    return created;
  });

  await logAudit({
    user: actor,
    action: "RECONCILIATION_INGEST",
    module: "reconciliation",
    entityType: "ReconciliationBatch",
    entityId: batch.id,
    newValue: { provider: input.provider, matchedCount, mismatchCount, missingInternalCount, unmatchedExternalCount },
  });

  await raiseReconciliationDiscrepancy({
    provider: input.provider,
    fileName: input.fileName,
    totalLines: drafts.length,
    mismatchCount,
    missingInternalCount,
    unmatchedExternalCount,
  });

  return batch;
}

export async function listReconciliationBatches(actor: CurrentUser) {
  if (!can(actor, "reconciliation", "view")) throw new ApiError(403, "Permission insuffisante.");
  return prisma.reconciliationBatch.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export async function getReconciliationBatch(actor: CurrentUser, id: string) {
  if (!can(actor, "reconciliation", "view")) throw new ApiError(403, "Permission insuffisante.");
  const batch = await prisma.reconciliationBatch.findUnique({
    where: { id },
    include: { entries: { include: { mobileMoneyTransaction: true }, orderBy: { status: "asc" } } },
  });
  if (!batch) throw new ApiError(404, "Lot de rapprochement introuvable.");
  return batch;
}

export async function resolveReconciliationEntry(actor: CurrentUser, entryId: string, resolutionNotes: string) {
  if (!can(actor, "reconciliation", "resolve")) throw new ApiError(403, "Permission insuffisante.");
  if (!resolutionNotes?.trim()) throw new ApiError(400, "Une note de resolution est requise.");
  const entry = await prisma.reconciliationEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new ApiError(404, "Ligne de rapprochement introuvable.");
  if (entry.status === "MATCHED") throw new ApiError(400, "Une ligne reconciliee n'a rien a resoudre.");
  if (entry.resolved) throw new ApiError(400, "Cette ligne est deja resolue.");

  const updated = await prisma.reconciliationEntry.update({
    where: { id: entryId },
    data: { resolved: true, resolvedById: actor.id, resolvedAt: new Date(), resolutionNotes: resolutionNotes.trim() },
  });

  await logAudit({
    user: actor,
    action: "RECONCILIATION_RESOLVE",
    module: "reconciliation",
    entityType: "ReconciliationEntry",
    entityId: entryId,
    newValue: { resolutionNotes: resolutionNotes.trim() },
  });

  return updated;
}
