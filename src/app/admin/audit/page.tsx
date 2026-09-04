import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, recordScopeWhere } from "@/lib/rbac";
import { listAuditLogsPage } from "@/lib/audit";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconShieldCheck, IconActivity } from "@/components/icons";

type LogRow = Awaited<ReturnType<typeof listAuditLogsPage>>["rows"][number];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "audit", "view")) redirect("/admin");

  const { module, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ rows: logs, total: logsTotal, pageSize }, modules, totalCount, failureCount] = await Promise.all([
    listAuditLogsPage(user, module, page),
    prisma.auditLog.findMany({ where: recordScopeWhere(user), distinct: ["module"], select: { module: true } }),
    prisma.auditLog.count({ where: recordScopeWhere(user) }),
    prisma.auditLog.count({ where: { ...recordScopeWhere(user), result: { not: "SUCCESS" } } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(logsTotal / pageSize));

  const columns: Column<LogRow>[] = [
    {
      key: "date",
      header: "Date",
      render: (log) => <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">{new Date(log.createdAt).toLocaleString("fr-FR")}</span>,
      sortable: true,
      sortValue: (log) => new Date(log.createdAt).getTime(),
    },
    { key: "user", header: "Utilisateur", render: (log) => log.userName, sortable: true, sortValue: (log) => log.userName },
    { key: "action", header: "Action", render: (log) => log.action, sortable: true, sortValue: (log) => log.action },
    { key: "module", header: "Module", render: (log) => <span className="text-[var(--color-text-muted)]">{log.module}</span>, sortable: true, sortValue: (log) => log.module },
    {
      key: "entity",
      header: "Objet",
      render: (log) => <span className="text-[var(--color-text-muted)]">{log.entityType ? `${log.entityType}${log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}` : "—"}</span>,
      sortable: true,
      sortValue: (log) => log.entityType ?? "",
    },
    {
      key: "result",
      header: "Resultat",
      render: (log) => <StatusBadge label={log.result} tone={log.result === "SUCCESS" ? "success" : "danger"} />,
      sortable: true,
      sortValue: (log) => log.result,
    },
    {
      key: "ip",
      header: "IP",
      render: (log) => <span className="text-xs text-[var(--color-text-muted)]">{log.ipAddress ?? "—"}</span>,
      sortable: true,
      sortValue: (log) => log.ipAddress ?? "",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Journal d'audit"
        description="Historique complet des actions sensibles. Lecture seule — non modifiable par les agents."
        action={
          can(user, "audit", "export") && (
            <a
              href={module ? `/api/audit/export?module=${module}` : "/api/audit/export"}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]"
            >
              Exporter (CSV)
            </a>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Actions enregistrees" value={totalCount} icon={<IconActivity className="h-5 w-5" />} tone="primary" />
        <StatCard label="Reussies" value={totalCount - failureCount} tone="success" />
        <StatCard label="Echecs / refus" value={failureCount} icon={<IconShieldCheck className="h-5 w-5" />} tone="danger" />
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href="/admin/audit"
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${!module ? "text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"}`}
          style={!module ? { background: "var(--gradient-primary)" } : undefined}
        >
          Tous
        </a>
        {modules.map((m) => (
          <a
            key={m.module}
            href={`/admin/audit?module=${m.module}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${module === m.module ? "text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"}`}
            style={module === m.module ? { background: "var(--gradient-primary)" } : undefined}
          >
            {m.module}
          </a>
        ))}
      </div>

      <DataTable columns={columns} rows={logs} keyField="id" emptyLabel="Aucune entree." pageSize={null} />
      <Pagination
        page={page}
        totalPages={totalPages}
        makeHref={(p) => `/admin/audit?${new URLSearchParams({ ...(module ? { module } : {}), page: String(p) })}`}
      />
    </div>
  );
}
