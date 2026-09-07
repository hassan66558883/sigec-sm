import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listSyncRuns } from "@/lib/services/integration-sync";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const STATUS_TONE: Record<string, StatusTone> = { RUNNING: "neutral", SUCCESS: "success", FAILED: "danger" };

type RunRow = Awaited<ReturnType<typeof listSyncRuns>>[number];

export default async function SyncRunsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "sync_manage")) redirect("/admin/integration");

  const { id } = await params;
  const runs = await listSyncRuns(user, id);

  const columns: Column<RunRow>[] = [
    { key: "started", header: "Started", render: (r) => <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">{new Date(r.startedAt).toLocaleString("fr-FR")}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge label={r.status} tone={STATUS_TONE[r.status] ?? "neutral"} /> },
    { key: "sent", header: "Records Sent", render: (r) => r.recordsSent },
    { key: "failed", header: "Records Failed", render: (r) => r.recordsFailed },
    {
      key: "duration",
      header: "Duration",
      render: (r) => (r.completedAt ? `${new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()} ms` : "—"),
    },
    { key: "error", header: "Error", render: (r) => r.errorMessage ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Sync Runs" description="Historique reel des executions de cette synchronisation (declenchees par le cron ou manuellement)." />
      <DataTable columns={columns} rows={runs} keyField="id" emptyLabel="Aucune execution." pageSize={null} />
    </div>
  );
}
