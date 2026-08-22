import { requirePermission, handleApiError } from "@/lib/api";
import { listHouseholdsForReport } from "@/lib/services/households";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("households", "export");
    const households = await listHouseholdsForReport(user);
    const csv = toCsv(households, [
      { header: "Code", value: (h) => h.code },
      { header: "Chef de menage", value: (h) => (h.head ? `${h.head.firstName} ${h.head.lastName}` : "") },
      { header: "Membres", value: (h) => h._count.members },
      { header: "Adresse", value: (h) => h.address },
      { header: "Arrondissement", value: (h) => h.arrondissement?.name },
      { header: "Quartier", value: (h) => h.quartier?.name },
      { header: "Date de creation", value: (h) => h.createdAt.toISOString().slice(0, 10) },
    ]);
    return csvResponse(`menages_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
