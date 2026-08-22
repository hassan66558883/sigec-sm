import { NextRequest } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listAuditLogs } from "@/lib/audit";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("audit", "export");
    const moduleFilter = req.nextUrl.searchParams.get("module") ?? undefined;
    const logs = await listAuditLogs(user, moduleFilter, 1000);
    const csv = toCsv(logs, [
      { header: "Date", value: (l) => l.createdAt.toISOString() },
      { header: "Utilisateur", value: (l) => l.userName },
      { header: "Action", value: (l) => l.action },
      { header: "Module", value: (l) => l.module },
      { header: "Type d'objet", value: (l) => l.entityType },
      { header: "Objet", value: (l) => l.entityId },
      { header: "Resultat", value: (l) => l.result },
      { header: "IP", value: (l) => l.ipAddress },
    ]);
    return csvResponse(`audit_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
