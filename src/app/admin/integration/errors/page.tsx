import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listIntegrationErrorsPage } from "@/lib/services/integration-errors";
import { ErrorActions } from "@/components/integration/error-actions";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";

const STATUS_TONE: Record<string, StatusTone> = { NEW: "danger", RETRYING: "warning", RESOLVED: "success", FAILED: "danger", IGNORED: "neutral" };

type ErrorRow = Awaited<ReturnType<typeof listIntegrationErrorsPage>>["rows"][number];

export default async function IntegrationErrorsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "logs")) redirect("/admin/integration");

  const { status, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { rows: errors, total, pageSize } = await listIntegrationErrorsPage(user, status, page);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<ErrorRow>[] = [
    { key: "date", header: "Date", render: (e) => <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">{new Date(e.createdAt).toLocaleString("fr-FR")}</span> },
    { key: "system", header: "System", render: (e) => e.system?.name ?? "—" },
    { key: "endpoint", header: "Endpoint", render: (e) => <span className="font-mono text-xs">{e.endpoint}</span> },
    { key: "type", header: "Error Type", render: (e) => e.errorType },
    { key: "message", header: "Message", render: (e) => <span className="text-[var(--color-text-muted)]">{e.message}</span> },
    { key: "retryCount", header: "Retries", render: (e) => e.retryCount },
    { key: "status", header: "Status", render: (e) => <StatusBadge label={e.status} tone={STATUS_TONE[e.status] ?? "neutral"} /> },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (e) => can(user, "integration", "retry") && <ErrorActions id={e.id} errorType={e.errorType} status={e.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Integration Errors" description="Echecs de test de connexion et rejets de l'API Gateway (authentification, scope, quota)." />

      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { href: "/admin/integration/errors", label: "Toutes", active: !status },
          { href: "/admin/integration/errors?status=NEW", label: "Nouvelles", active: status === "NEW" },
          { href: "/admin/integration/errors?status=RESOLVED", label: "Resolues", active: status === "RESOLVED" },
          { href: "/admin/integration/errors?status=IGNORED", label: "Ignorees", active: status === "IGNORED" },
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

      <DataTable columns={columns} rows={errors} keyField="id" emptyLabel="Aucune erreur." pageSize={null} />
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/integration/errors?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`} />
    </div>
  );
}
