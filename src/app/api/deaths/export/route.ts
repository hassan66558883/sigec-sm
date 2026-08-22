import { requirePermission, handleApiError } from "@/lib/api";
import { listDeathRecordsForReport } from "@/lib/services/deaths";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("deaths", "export");
    const records = await listDeathRecordsForReport(user);
    const csv = toCsv(records, [
      { header: "Numero d'acte", value: (r) => r.recordNumber },
      { header: "Defunt", value: (r) => `${r.deceased.firstName} ${r.deceased.lastName}` },
      { header: "Sexe", value: (r) => r.deceased.sex },
      { header: "Date du deces", value: (r) => r.dateOfDeath.toISOString().slice(0, 10) },
      { header: "Lieu du deces", value: (r) => r.placeOfDeath },
      { header: "Declarant", value: (r) => r.declarantName },
      { header: "Statut", value: (r) => r.status },
      { header: "Arrondissement", value: (r) => r.arrondissement?.name },
    ]);
    return csvResponse(`deces_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
