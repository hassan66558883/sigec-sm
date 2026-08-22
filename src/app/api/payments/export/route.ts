import { requirePermission, handleApiError } from "@/lib/api";
import { listPayments } from "@/lib/services/payments";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("payments", "export");
    const payments = await listPayments(user);
    const csv = toCsv(payments, [
      { header: "Recu", value: (p) => p.receiptNumber },
      { header: "Date", value: (p) => p.paymentDate.toISOString() },
      { header: "Payeur", value: (p) => `${p.payer.firstName} ${p.payer.lastName}` },
      { header: "Montant", value: (p) => p.amount },
      { header: "Mode de paiement", value: (p) => p.paymentMethod },
      { header: "Type de taxe", value: (p) => p.taxType?.name },
      { header: "Arrondissement", value: (p) => p.arrondissement?.name ?? "Mairie Centrale" },
      { header: "Statut", value: (p) => p.status },
    ]);
    return csvResponse(`recettes_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
