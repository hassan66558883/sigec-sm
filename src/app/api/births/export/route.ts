import { requirePermission, handleApiError } from "@/lib/api";
import { listBirthRecordsForReport } from "@/lib/services/births";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("births", "export");
    const records = await listBirthRecordsForReport(user);
    const csv = toCsv(records, [
      { header: "Numero d'acte", value: (r) => r.recordNumber },
      { header: "Enfant", value: (r) => `${r.child.firstName} ${r.child.lastName}` },
      { header: "Sexe", value: (r) => r.child.sex },
      { header: "Date de naissance", value: (r) => r.dateOfBirth.toISOString().slice(0, 10) },
      { header: "Lieu de naissance", value: (r) => r.placeOfBirth },
      { header: "Declarant", value: (r) => r.declarantName },
      { header: "Statut", value: (r) => r.status },
      { header: "Arrondissement", value: (r) => r.arrondissement?.name },
    ]);
    return csvResponse(`naissances_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
