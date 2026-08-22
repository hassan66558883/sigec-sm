import { NextRequest } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listPaymentsForReport } from "@/lib/services/payments";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("payments", "export");
    const params = req.nextUrl.searchParams;
    const payments = await listPaymentsForReport(user, {
      dateFrom: params.get("dateFrom") ?? undefined,
      dateTo: params.get("dateTo") ?? undefined,
      arrondissementId: params.get("arrondissementId") ?? undefined,
      agentId: params.get("agentId") ?? undefined,
      paymentMethod: params.get("paymentMethod") ?? undefined,
      status: params.get("status") ?? undefined,
    });
    const csv = toCsv(payments, [
      { header: "Recu", value: (p) => p.receiptNumber },
      { header: "Date", value: (p) => p.paymentDate.toISOString() },
      { header: "Payeur", value: (p) => `${p.payer.firstName} ${p.payer.lastName}` },
      { header: "Montant", value: (p) => p.amount },
      { header: "Mode de paiement", value: (p) => p.paymentMethod },
      { header: "Statut", value: (p) => p.status },
      { header: "Agent", value: (p) => p.agent?.user.name },
      { header: "Arrondissement", value: (p) => p.arrondissement?.name ?? "Mairie Centrale" },
    ]);
    return csvResponse(`rapport_recettes_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
