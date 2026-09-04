import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listInfrastructureForStaffPage } from "@/lib/services/infrastructure";
import { StatusSelect } from "@/components/municipal/status-select";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";

const TYPE_LABEL: Record<string, string> = {
  ROAD: "Route", LIGHTING: "Eclairage", DRAINAGE: "Caniveau", WASTE: "Dechets", PUBLIC_SPACE: "Espace public", OTHER: "Autre",
};
const STATUS_LABEL: Record<string, string> = { REPORTED: "Signale", IN_PROGRESS: "En cours", COMPLETED: "Termine" };
const STATUS_TONE: Record<string, StatusTone> = { REPORTED: "warning", IN_PROGRESS: "warning", COMPLETED: "success" };

type ReportRow = Awaited<ReturnType<typeof listInfrastructureForStaffPage>>["rows"][number];

export default async function InfrastructurePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "infrastructure", "view")) redirect("/admin");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { rows: reports, total, pageSize } = await listInfrastructureForStaffPage(user, page);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<ReportRow>[] = [
    {
      key: "reportNumber",
      header: "Numero",
      render: (r) => <span className="text-xs text-[var(--color-text-muted)]">{r.reportNumber}</span>,
      sortable: true,
      sortValue: (r) => r.reportNumber,
    },
    { key: "type", header: "Type", render: (r) => TYPE_LABEL[r.type], sortable: true, sortValue: (r) => r.type },
    { key: "description", header: "Description", render: (r) => r.description, sortable: true, sortValue: (r) => r.description },
    {
      key: "location",
      header: "Localisation",
      render: (r) => <span className="text-[var(--color-text-muted)]">{r.location || "—"}</span>,
      sortable: true,
      sortValue: (r) => r.location || "",
    },
    {
      key: "status",
      header: "Statut",
      render: (r) =>
        can(user, "infrastructure", "update") ? (
          <StatusSelect endpoint={`/api/infrastructure/${r.id}`} value={r.status} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        ) : (
          <StatusBadge label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
        ),
      sortable: true,
      sortValue: (r) => r.status,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Voirie & infrastructures" description="Signalements de problemes de voirie, eclairage, proprete..." />

      <DataTable columns={columns} rows={reports} keyField="id" emptyLabel="Aucun signalement." pageSize={null} />
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/infrastructure?${new URLSearchParams({ page: String(p) })}`} />
    </div>
  );
}
