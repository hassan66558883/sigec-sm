import { requirePermission, handleApiError } from "@/lib/api";
import { listArrondissements } from "@/lib/services/territorial";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("territorial", "export");
    const arrondissements = await listArrondissements(user);
    const csv = toCsv(arrondissements, [
      { header: "Numero", value: (a) => a.number },
      { header: "Nom", value: (a) => a.name },
      { header: "Code", value: (a) => a.code },
      { header: "Ville", value: (a) => a.city.name },
      { header: "Quartiers", value: (a) => a._count.quartiers },
      { header: "Statut", value: (a) => (a.isActive ? "Actif" : "Inactif") },
    ]);
    return csvResponse(`arrondissements_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
