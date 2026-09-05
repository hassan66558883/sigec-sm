import { NextRequest } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listComplaintsForExport, COMPLAINT_DASHBOARD_VIEWS, type ComplaintDashboardView } from "@/lib/services/complaints";
import { COMPLAINT_STATUS_LABEL } from "@/lib/complaint-labels";
import { toCsv, csvResponse } from "@/lib/csv";

const PRIORITY_LABEL: Record<string, string> = { FAIBLE: "Faible", NORMAL: "Normal", IMPORTANT: "Important", URGENT: "Urgent", CRITIQUE: "Critique" };

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("complaints", "export");
    const viewParam = req.nextUrl.searchParams.get("view");
    const view: ComplaintDashboardView = (COMPLAINT_DASHBOARD_VIEWS as readonly string[]).includes(viewParam ?? "") ? (viewParam as ComplaintDashboardView) : "all";

    const complaints = await listComplaintsForExport(user, view);
    const csv = toCsv(complaints, [
      { header: "Numero", value: (c) => c.caseNumber },
      { header: "Date de depot", value: (c) => c.createdAt.toISOString() },
      { header: "Citoyen", value: (c) => `${c.citizenAccount.citizen.firstName} ${c.citizenAccount.citizen.lastName}` },
      { header: "Categorie", value: (c) => c.category },
      { header: "Priorite", value: (c) => PRIORITY_LABEL[c.priority] ?? c.priority },
      { header: "Statut", value: (c) => COMPLAINT_STATUS_LABEL[c.status] ?? c.status },
      { header: "Service affecte", value: (c) => c.assignedDepartment?.name },
      { header: "Echeance SLA", value: (c) => c.dueAt?.toISOString() },
      { header: "Date de resolution", value: (c) => c.resolvedAt?.toISOString() },
      { header: "Date de cloture", value: (c) => c.closedAt?.toISOString() },
    ]);
    return csvResponse(`plaintes_${view}_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
