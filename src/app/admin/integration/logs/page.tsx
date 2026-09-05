import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listIntegrationLogsPage } from "@/lib/services/integration-logs";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";

type LogRow = Awaited<ReturnType<typeof listIntegrationLogsPage>>["rows"][number];

export default async function IntegrationLogsPage({ searchParams }: { searchParams: Promise<{ endpoint?: string; success?: string; page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "logs")) redirect("/admin/integration");

  const { endpoint, success, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { rows: logs, total, pageSize } = await listIntegrationLogsPage(
    user,
    { endpoint, success: success === "true" ? true : success === "false" ? false : undefined },
    page,
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<LogRow>[] = [
    { key: "date", header: "Timestamp", render: (l) => <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">{new Date(l.createdAt).toLocaleString("fr-FR")}</span> },
    { key: "system", header: "System", render: (l) => l.system?.name ?? "—" },
    { key: "endpoint", header: "Endpoint", render: (l) => <span className="font-mono text-xs">{l.method} {l.endpoint}</span> },
    { key: "status", header: "Status Code", render: (l) => <StatusBadge label={String(l.statusCode)} tone={l.success ? "success" : "danger"} /> },
    { key: "time", header: "Response Time", render: (l) => `${l.responseTimeMs} ms` },
    { key: "correlation", header: "Correlation ID", render: (l) => <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{l.correlationId}</span> },
    { key: "error", header: "Error", render: (l) => l.errorMessage ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Integration Logs" description="Chaque appel passe par l'API Gateway, succes comme echec." />

      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { href: "/admin/integration/logs", label: "Tous", active: !success },
          { href: "/admin/integration/logs?success=true", label: "Succes", active: success === "true" },
          { href: "/admin/integration/logs?success=false", label: "Echecs", active: success === "false" },
        ].map((tab) => (
          <a
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-3 py-1 font-medium transition ${tab.active ? "text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"}`}
            style={tab.active ? { background: "var(--gradient-primary)" } : undefined}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <DataTable columns={columns} rows={logs} keyField="id" emptyLabel="Aucun appel enregistre." pageSize={null} />
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/integration/logs?${new URLSearchParams({ ...(success ? { success } : {}), page: String(p) })}`} />
    </div>
  );
}
