import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listSyncJobs } from "@/lib/services/integration-sync";
import { listIntegrationSystems } from "@/lib/services/integration-systems";
import { NewSyncJobForm } from "@/components/integration/new-sync-job-form";
import { SyncJobActions } from "@/components/integration/sync-job-actions";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import Link from "next/link";

const STATUS_TONE: Record<string, StatusTone> = { ACTIVE: "success", DISABLED: "neutral" };

type JobRow = Awaited<ReturnType<typeof listSyncJobs>>[number];

export default async function SyncPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "sync_manage")) redirect("/admin/integration");

  const [jobs, systems] = await Promise.all([listSyncJobs(user), listIntegrationSystems(user)]);
  const systemsWithUrl = systems.filter((s) => s.baseUrl);

  const columns: Column<JobRow>[] = [
    { key: "system", header: "System", render: (j) => j.system.name },
    { key: "entity", header: "Entity", render: (j) => j.entityType },
    { key: "type", header: "Sync Type", render: (j) => (j.syncType === "SCHEDULED" ? `SCHEDULED (${j.intervalMinutes}min)` : "MANUAL") },
    { key: "endpoint", header: "Endpoint", render: (j) => <span className="font-mono text-xs" dir="ltr">{j.endpointPath}</span> },
    { key: "lastSync", header: "Last Sync", render: (j) => (j.lastSyncAt ? new Date(j.lastSyncAt).toLocaleString("fr-FR") : "—") },
    { key: "nextSync", header: "Next Sync", render: (j) => (j.nextSyncAt ? new Date(j.nextSyncAt).toLocaleString("fr-FR") : "—") },
    { key: "status", header: "Status", render: (j) => <StatusBadge label={j.status} tone={STATUS_TONE[j.status] ?? "neutral"} /> },
    { key: "runs", header: "Runs", render: (j) => <Link href={`/admin/integration/sync/${j.id}`} className="text-[var(--color-primary)] hover:underline">{j._count.runs}</Link> },
    { key: "actions", header: "", align: "end", render: (j) => <SyncJobActions id={j.id} status={j.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Synchronization"
        description="Export par lot (Scheduled/Manual) des enregistrements crees ou modifies vers un systeme externe. Le temps reel/par evenement est deja couvert par les Webhooks."
        action={<NewSyncJobForm systems={systemsWithUrl.map((s) => ({ id: s.id, label: s.name }))} />}
      />
      <DataTable columns={columns} rows={jobs} keyField="id" emptyLabel="Aucune synchronisation configuree." pageSize={null} />
    </div>
  );
}
