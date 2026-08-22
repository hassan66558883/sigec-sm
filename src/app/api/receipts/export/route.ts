import { requirePermission, handleApiError } from "@/lib/api";
import { listReceipts } from "@/lib/services/receipts";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("receipts", "export");
    const receipts = await listReceipts(user);
    const csv = toCsv(receipts, [
      { header: "Numero", value: (r) => r.number },
      { header: "Date", value: (r) => r.payment.paymentDate.toISOString() },
      { header: "Payeur", value: (r) => `${r.payment.payer.firstName} ${r.payment.payer.lastName}` },
      { header: "Montant", value: (r) => r.payment.amount },
      { header: "Mode de paiement", value: (r) => r.payment.paymentMethod },
      { header: "Arrondissement", value: (r) => r.payment.arrondissement?.name ?? "Mairie Centrale" },
      { header: "Statut", value: (r) => r.status },
    ]);
    return csvResponse(`recus_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
