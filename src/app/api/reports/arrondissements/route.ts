import { requirePermission, handleApiError } from "@/lib/api";
import { can } from "@/lib/rbac";
import { getArrondissementStatsReport } from "@/lib/services/analytics";
import { toCsv, csvResponse, type CsvColumn } from "@/lib/csv";

type Row = Awaited<ReturnType<typeof getArrondissementStatsReport>>[number];

export async function GET() {
  try {
    const user = await requirePermission("territorial", "export");
    const rows = await getArrondissementStatsReport(user);

    const columns: CsvColumn<Row>[] = [
      { header: "Arrondissement", value: (r) => r.name },
      { header: "Code", value: (r) => r.code },
    ];
    if (can(user, "citizens", "view")) columns.push({ header: "Population", value: (r) => r.population });
    if (can(user, "households", "view")) columns.push({ header: "Menages", value: (r) => r.menages });
    if (can(user, "births", "view")) columns.push({ header: "Naissances", value: (r) => r.naissances });
    if (can(user, "marriages", "view")) columns.push({ header: "Mariages", value: (r) => r.mariages });
    if (can(user, "divorces", "view")) columns.push({ header: "Divorces", value: (r) => r.divorces });
    if (can(user, "deaths", "view")) columns.push({ header: "Deces", value: (r) => r.deces });
    if (can(user, "payments", "view")) columns.push({ header: "Recettes (FCFA)", value: (r) => r.recettes });
    if (can(user, "obligations", "view")) columns.push({ header: "Impayes", value: (r) => r.impayes });
    if (can(user, "markets", "view")) columns.push({ header: "Marches", value: (r) => r.marches });
    if (can(user, "businesses", "view")) columns.push({ header: "Commerces", value: (r) => r.commerces });
    if (can(user, "applications", "view")) columns.push({ header: "Demandes", value: (r) => r.demandes });

    const csv = toCsv(rows, columns);
    return csvResponse(`statistiques_arrondissements_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
