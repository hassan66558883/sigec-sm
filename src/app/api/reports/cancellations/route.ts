import { requirePermission, handleApiError } from "@/lib/api";
import { listCancellations } from "@/lib/services/payments";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("payments", "export");
    const rows = await listCancellations(user);
    const csv = toCsv(rows, [
      { header: "Date", value: (c) => c.createdAt.toISOString() },
      { header: "Recu paiement", value: (c) => c.payment.receiptNumber },
      { header: "Payeur", value: (c) => `${c.payment.payer.firstName} ${c.payment.payer.lastName}` },
      { header: "Montant", value: (c) => c.payment.amount },
      { header: "Motif", value: (c) => c.reason },
      { header: "Annule par", value: (c) => c.cancelledByName },
      { header: "Arrondissement", value: (c) => c.payment.arrondissement?.name ?? "Mairie Centrale" },
    ]);
    return csvResponse(`rapport_annulations_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
