import { requirePermission, handleApiError } from "@/lib/api";
import { listMarriagesForReport } from "@/lib/services/marriages";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("marriages", "export");
    const records = await listMarriagesForReport(user);
    const csv = toCsv(records, [
      { header: "Numero d'acte", value: (r) => r.recordNumber },
      { header: "Epoux", value: (r) => `${r.husband.firstName} ${r.husband.lastName}` },
      { header: "Epouse", value: (r) => `${r.wife.firstName} ${r.wife.lastName}` },
      { header: "Date du mariage", value: (r) => r.marriageDate.toISOString().slice(0, 10) },
      { header: "Lieu", value: (r) => r.marriagePlace },
      { header: "Regime", value: (r) => r.regime?.name },
      { header: "Statut", value: (r) => r.status },
      { header: "Arrondissement", value: (r) => r.arrondissement?.name },
    ]);
    return csvResponse(`mariages_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
