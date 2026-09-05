import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listIntegrationSystems } from "@/lib/services/integration-systems";
import { NewSystemForm } from "@/components/integration/new-system-form";
import { TestConnectionButton, ToggleSystemEnabledButton } from "@/components/integration/system-actions";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const STATUS_TONE: Record<string, StatusTone> = {
  CONNECTED: "success",
  WARNING: "warning",
  OFFLINE: "danger",
  DISABLED: "neutral",
  TESTING: "neutral",
};

type SystemRow = Awaited<ReturnType<typeof listIntegrationSystems>>[number];

export default async function IntegrationSystemsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "view")) redirect("/admin");

  const systems = await listIntegrationSystems(user);

  const columns: Column<SystemRow>[] = [
    { key: "name", header: "System Name", render: (s) => <span className="font-medium">{s.name}</span>, sortable: true, sortValue: (s) => s.name },
    { key: "code", header: "Code", render: (s) => <span className="font-mono text-xs text-[var(--color-text-muted)]">{s.code}</span> },
    { key: "type", header: "Type", render: (s) => s.type, sortable: true, sortValue: (s) => s.type },
    { key: "environment", header: "Environment", render: (s) => s.environment },
    { key: "status", header: "Status", render: (s) => <StatusBadge label={s.status} tone={STATUS_TONE[s.status] ?? "neutral"} />, sortable: true, sortValue: (s) => s.status },
    { key: "apiKeys", header: "API Keys", render: (s) => s._count.apiKeys },
    {
      key: "lastTest",
      header: "Last Test",
      render: (s) => (s.lastTestAt ? <span className="text-xs text-[var(--color-text-muted)]">{new Date(s.lastTestAt).toLocaleString("fr-FR")}</span> : "—"),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (s) =>
        can(user, "integration", "test") && (
          <div className="flex items-center justify-end gap-2">
            <TestConnectionButton systemId={s.id} />
            {can(user, "integration", "update") && <ToggleSystemEnabledButton systemId={s.id} enabled={s.enabled} />}
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Connected Systems"
        description="Systemes externes (banques, mobile money, administrations, ERP...) connectes a SIGEC-SM via l'API Gateway."
        action={can(user, "integration", "create") ? <NewSystemForm /> : undefined}
      />
      <DataTable columns={columns} rows={systems} keyField="id" emptyLabel="Aucun systeme connecte." pageSize={null} />
    </div>
  );
}
