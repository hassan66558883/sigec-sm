import { requirePermission, handleApiError } from "@/lib/api";
import { listUnpaidObligations } from "@/lib/services/obligations";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("obligations", "view");
    const rows = await listUnpaidObligations(user);
    const csv = toCsv(rows, [
      { header: "Numero", value: (o) => o.number },
      { header: "Contribuable", value: (o) => `${o.citizen.firstName} ${o.citizen.lastName}` },
      { header: "Periode", value: (o) => o.period },
      { header: "Montant du", value: (o) => o.initialAmount },
      { header: "Solde", value: (o) => o.balance },
      { header: "Echeance", value: (o) => o.dueDate.toISOString().slice(0, 10) },
      { header: "Statut", value: (o) => o.status },
      { header: "Arrondissement", value: (o) => o.arrondissement.name },
    ]);
    return csvResponse(`rapport_impayes_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
