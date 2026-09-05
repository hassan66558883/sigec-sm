import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listFraudAlertsPage } from "@/lib/services/fraud";
import { ResolveAlertForm } from "@/components/finances/resolve-alert-form";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";

const SEVERITY_TONE: Record<string, StatusTone> = {
  LOW: "neutral",
  MEDIUM: "warning",
  HIGH: "warning",
  CRITICAL: "danger",
};

const TYPE_LABEL: Record<string, string> = {
  DOUBLE_PAYMENT: "Double paiement",
  DOUBLE_RECEIPT: "Double reçu",
  FORBIDDEN_MODIFICATION: "Modification interdite",
  EXCESSIVE_CANCELLATIONS: "Annulations excessives",
  CASH_DISCREPANCY: "Ecart de caisse",
  OUT_OF_ZONE: "Collecte hors zone",
  UNKNOWN_DEVICE: "Appareil inconnu",
  SUSPICIOUS_VOLUME: "Activite suspecte",
  OFF_HOURS: "Hors horaires",
  SUSPICIOUS_RECEIPT: "Reçu suspect",
  QR_INVALID_REUSE: "QR invalide reutilise",
  QR_SCAN_ANOMALY: "Scans QR anormaux",
  RECONCILIATION_DISCREPANCY: "Ecart de rapprochement",
};

type AlertRow = Awaited<ReturnType<typeof listFraudAlertsPage>>["rows"][number];

export default async function FraudPage({ searchParams }: { searchParams: Promise<{ status?: string; severity?: string; page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "fraud", "view")) redirect("/admin");
  const { status, severity, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { rows: alerts, total, pageSize } = await listFraudAlertsPage(user, { status: status ?? "OUVERTE", severity }, page);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<AlertRow>[] = [
    { key: "date", header: "Date", render: (a) => <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">{new Date(a.createdAt).toLocaleString("fr-FR")}</span>, sortable: true, sortValue: (a) => new Date(a.createdAt).getTime() },
    { key: "type", header: "Type", render: (a) => TYPE_LABEL[a.type] ?? a.type, sortable: true, sortValue: (a) => TYPE_LABEL[a.type] ?? a.type },
    { key: "severity", header: "Severite", render: (a) => <StatusBadge label={a.severity} tone={SEVERITY_TONE[a.severity] ?? "neutral"} />, sortable: true, sortValue: (a) => a.severity },
    { key: "description", header: "Description", render: (a) => <span className="text-[var(--color-text-muted)]">{a.description}</span>, sortable: true, sortValue: (a) => a.description },
    { key: "agent", header: "Agent", render: (a) => <span className="text-[var(--color-text-muted)]">{a.agent?.user.name ?? "—"}</span>, sortable: true, sortValue: (a) => a.agent?.user.name ?? "" },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (a) => a.status === "OUVERTE" && can(user, "fraud", "resolve") && <ResolveAlertForm id={a.id} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Controle anti-fraude" description="Alertes generees automatiquement — jamais bloquantes, toujours journalisees et traitables." />

      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { href: "/admin/fraud", label: "Ouvertes", active: (status ?? "OUVERTE") === "OUVERTE" },
          { href: "/admin/fraud?status=RESOLUE", label: "Resolues", active: status === "RESOLUE" },
          { href: "/admin/fraud?status=IGNOREE", label: "Ignorees", active: status === "IGNOREE" },
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

      <DataTable columns={columns} rows={alerts} keyField="id" emptyLabel="Aucune alerte." pageSize={null} />
      <Pagination
        page={page}
        totalPages={totalPages}
        makeHref={(p) => `/admin/fraud?${new URLSearchParams({ ...(status ? { status } : {}), ...(severity ? { severity } : {}), page: String(p) })}`}
      />
    </div>
  );
}
