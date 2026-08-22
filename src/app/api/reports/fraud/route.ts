import { requirePermission, handleApiError } from "@/lib/api";
import { listFraudAlerts } from "@/lib/services/fraud";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("fraud", "view");
    const rows = await listFraudAlerts(user);
    const csv = toCsv(rows, [
      { header: "Date", value: (a) => a.createdAt.toISOString() },
      { header: "Type", value: (a) => a.type },
      { header: "Severite", value: (a) => a.severity },
      { header: "Description", value: (a) => a.description },
      { header: "Agent", value: (a) => a.agent?.user.name },
      { header: "Statut", value: (a) => a.status },
      { header: "Arrondissement", value: (a) => a.arrondissement?.name },
    ]);
    return csvResponse(`rapport_anomalies_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
