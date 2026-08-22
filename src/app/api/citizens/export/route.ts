import { NextRequest } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listCitizensForReport } from "@/lib/services/citizens";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("citizens", "export");
    const search = req.nextUrl.searchParams.get("search") ?? undefined;
    const citizens = await listCitizensForReport(user, search);
    const csv = toCsv(citizens, [
      { header: "Numero unique", value: (c) => c.uniqueNumber },
      { header: "Nom", value: (c) => c.lastName },
      { header: "Prenom", value: (c) => c.firstName },
      { header: "Sexe", value: (c) => c.sex },
      { header: "Date de naissance", value: (c) => c.dateOfBirth?.toISOString().slice(0, 10) },
      { header: "Arrondissement", value: (c) => c.arrondissement?.name },
      { header: "Quartier", value: (c) => c.quartier?.name },
      { header: "Telephone", value: (c) => c.phone },
    ]);
    return csvResponse(`citoyens_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
