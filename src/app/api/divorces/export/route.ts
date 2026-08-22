import { requirePermission, handleApiError } from "@/lib/api";
import { listDivorcesForReport } from "@/lib/services/divorces";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("divorces", "export");
    const records = await listDivorcesForReport(user);
    const csv = toCsv(records, [
      { header: "Numero d'acte", value: (r) => r.recordNumber },
      { header: "Epoux", value: (r) => `${r.marriage.husband.firstName} ${r.marriage.husband.lastName}` },
      { header: "Epouse", value: (r) => `${r.marriage.wife.firstName} ${r.marriage.wife.lastName}` },
      { header: "Date du divorce", value: (r) => r.divorceDate.toISOString().slice(0, 10) },
      { header: "Reference decision", value: (r) => r.decisionReference },
      { header: "Statut", value: (r) => r.status },
      { header: "Arrondissement", value: (r) => r.arrondissement?.name },
    ]);
    return csvResponse(`divorces_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
