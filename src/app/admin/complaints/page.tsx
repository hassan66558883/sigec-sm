import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listComplaintsForStaffPage, getComplaintsDashboardStats, computeSlaStatus, type ComplaintDashboardView } from "@/lib/services/complaints";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { COMPLAINT_STATUS_LABEL } from "@/lib/complaint-labels";

const CATEGORY_LABEL: Record<string, string> = {
  VOIRIE: "Voirie",
  PROPRETE: "Proprete",
  ECLAIRAGE: "Eclairage",
  EAU: "Eau",
  SECURITE: "Securite",
  AUTRE: "Autre",
};
const PRIORITY_LABEL: Record<string, string> = { FAIBLE: "Faible", NORMAL: "Normal", IMPORTANT: "Important", URGENT: "Urgent", CRITIQUE: "Critique" };
const PRIORITY_TONE: Record<string, StatusTone> = { FAIBLE: "neutral", NORMAL: "neutral", IMPORTANT: "warning", URGENT: "danger", CRITIQUE: "danger" };
// Ancien vocabulaire (NEW/ASSIGNED/PENDING) conserve pour les rares
// plaintes creees avant le workflow a 13 etats (module Plaintes &
// Doleances) — COMPLAINT_STATUS_LABEL (lib/complaint-labels.ts) est la
// reference pour toute nouvelle plainte, fusionnee ici pour l'affichage.
const STATUS_LABEL: Record<string, string> = {
  NEW: "Nouveau",
  RECEIVED: "Recu",
  ASSIGNED: "Affecte",
  IN_PROGRESS: "En cours",
  PENDING: "En attente",
  RESOLVED: "Resolu",
  CLOSED: "Cloture",
  ...COMPLAINT_STATUS_LABEL,
};
const STATUS_TONE: Record<string, StatusTone> = {
  NEW: "warning",
  RECEIVED: "warning",
  ASSIGNED: "warning",
  RESOLVED: "success",
  CLOSED: "success",
  SUBMITTED: "warning",
  VERIFYING: "warning",
  NEEDS_INFO: "warning",
  ASSIGNED_DEPT: "warning",
  ASSIGNED_AGENT: "warning",
  IN_PROGRESS: "warning",
  WAITING: "neutral",
  VALIDATING: "warning",
  REJECTED: "danger",
};

const VIEW_TABS: { value: ComplaintDashboardView; label: string; statKey: "total" | "mine" | "new" | "urgent" | "late" | "today" | "waiting" | "resolved" }[] = [
  { value: "all", label: "Toutes", statKey: "total" },
  { value: "mine", label: "Mes plaintes", statKey: "mine" },
  { value: "new", label: "Nouvelles", statKey: "new" },
  { value: "urgent", label: "Urgentes", statKey: "urgent" },
  { value: "late", label: "En retard", statKey: "late" },
  { value: "today", label: "A traiter aujourd'hui", statKey: "today" },
  { value: "waiting", label: "En attente", statKey: "waiting" },
  { value: "resolved", label: "Resolues", statKey: "resolved" },
];

type ComplaintRow = Awaited<ReturnType<typeof listComplaintsForStaffPage>>["rows"][number];

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "complaints", "view")) redirect("/admin");
  const { page: pageParam, view: viewParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const view: ComplaintDashboardView = (VIEW_TABS.find((t) => t.value === viewParam)?.value ?? "all");

  const [{ rows: complaints, total, pageSize }, stats] = await Promise.all([
    listComplaintsForStaffPage(user, page, undefined, view),
    getComplaintsDashboardStats(user),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<ComplaintRow>[] = [
    {
      key: "caseNumber",
      header: "Numero",
      render: (c) => (
        <Link href={`/admin/complaints/${c.id}`} className="text-xs text-[var(--color-primary)] hover:underline">
          {c.caseNumber}
        </Link>
      ),
      sortable: true,
      sortValue: (c) => c.caseNumber,
    },
    {
      key: "citizen",
      header: "Citoyen",
      render: (c) => <>{c.citizenAccount.citizen.firstName} {c.citizenAccount.citizen.lastName}</>,
      sortable: true,
      sortValue: (c) => `${c.citizenAccount.citizen.lastName} ${c.citizenAccount.citizen.firstName}`,
    },
    {
      key: "category",
      header: "Categorie",
      render: (c) => <span className="text-[var(--color-text-muted)]">{CATEGORY_LABEL[c.category] ?? c.category}</span>,
      sortable: true,
      sortValue: (c) => c.category,
    },
    {
      key: "priority",
      header: "Priorite",
      render: (c) => <StatusBadge label={PRIORITY_LABEL[c.priority] ?? c.priority} tone={PRIORITY_TONE[c.priority] ?? "neutral"} />,
      sortable: true,
      sortValue: (c) => c.priority,
    },
    {
      key: "status",
      header: "Statut",
      render: (c) => <StatusBadge label={STATUS_LABEL[c.status]} tone={STATUS_TONE[c.status]} />,
      sortable: true,
      sortValue: (c) => c.status,
    },
    {
      key: "sla",
      header: "SLA",
      render: (c) => {
        const sla = c.dueAt ? computeSlaStatus(c.dueAt, c.resolvedAt, c.slaHours) : null;
        if (!sla) return <span className="text-[var(--color-text-muted)]">—</span>;
        const label = sla === "ON_TIME" ? "Dans les delais" : sla === "AT_RISK" ? "Attention" : "En retard";
        const tone: StatusTone = sla === "ON_TIME" ? "success" : sla === "AT_RISK" ? "warning" : "danger";
        return <StatusBadge label={label} tone={tone} dot={false} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Plaintes & doleances"
        description="Guichet numerique — suivi des signalements citoyens."
        action={
          can(user, "complaints", "export") && (
            <a
              href={view !== "all" ? `/api/complaints/export?view=${view}` : "/api/complaints/export"}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]"
            >
              Exporter (CSV)
            </a>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} tone="primary" />
        <StatCard label="Mes plaintes" value={stats.mine} tone="primary" />
        <StatCard label="Nouvelles" value={stats.new} tone="warning" />
        <StatCard label="Urgentes" value={stats.urgent} tone="danger" />
        <StatCard label="En retard" value={stats.late} tone="danger" />
        <StatCard label="A traiter aujourd'hui" value={stats.today} tone="warning" />
        <StatCard label="En attente" value={stats.waiting} tone="gold" />
        <StatCard label="Resolues" value={stats.resolved} tone="success" />
      </div>

      <div className="flex flex-wrap gap-2">
        {VIEW_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/admin/complaints" : `/admin/complaints?view=${tab.value}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              view === tab.value ? "text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            }`}
            style={view === tab.value ? { background: "var(--gradient-primary)" } : undefined}
          >
            {tab.label} ({stats[tab.statKey]})
          </Link>
        ))}
      </div>

      <DataTable columns={columns} rows={complaints} keyField="id" emptyLabel="Aucune plainte dans cette vue." pageSize={null} />
      <Pagination
        page={page}
        totalPages={totalPages}
        makeHref={(p) => `/admin/complaints?${new URLSearchParams({ ...(view !== "all" ? { view } : {}), page: String(p) })}`}
      />
    </div>
  );
}
