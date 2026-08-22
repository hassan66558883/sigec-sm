import { requirePermission, handleApiError } from "@/lib/api";
import { listMobileMoneyTransactions } from "@/lib/services/mobile-money";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("mobile_money", "view");
    const rows = await listMobileMoneyTransactions(user);
    const csv = toCsv(rows, [
      { header: "Reference", value: (t) => t.externalReference },
      { header: "Payeur", value: (t) => `${t.payment.payer.firstName} ${t.payment.payer.lastName}` },
      { header: "Telephone", value: (t) => t.phoneNumber },
      { header: "Montant", value: (t) => t.amount },
      { header: "Initiee", value: (t) => t.initiatedAt.toISOString() },
      { header: "Confirmee", value: (t) => t.confirmedAt?.toISOString() },
      { header: "Statut", value: (t) => t.status },
      { header: "Arrondissement", value: (t) => t.payment.arrondissement?.name ?? "Mairie Centrale" },
    ]);
    return csvResponse(`rapport_mobile_money_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
