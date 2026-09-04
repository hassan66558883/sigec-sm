import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listVersementsPage } from "@/lib/services/versements";
import { listCaissesAwaitingVersement } from "@/lib/services/caisses";
import { VersementForm } from "@/components/caisses/versement-form";
import { ValidateVersementButtons } from "@/components/caisses/validate-versement-buttons";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

const STATUS_TONE: Record<string, StatusTone> = {
  EN_ATTENTE: "warning",
  VALIDE: "success",
  ECART: "danger",
  REJETE: "danger",
};

type VersementRow = Awaited<ReturnType<typeof listVersementsPage>>["rows"][number];

export default async function VersementsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "versements", "view")) redirect("/admin");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ rows: versements, total, pageSize }, caisses] = await Promise.all([
    listVersementsPage(user, page),
    can(user, "versements", "create") ? listCaissesAwaitingVersement(user) : Promise.resolve([]),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<VersementRow>[] = [
    { key: "number", header: "Numero", render: (v) => <span className="text-xs text-[var(--color-text-muted)]">{v.number}</span>, sortable: true, sortValue: (v) => v.number },
    { key: "agent", header: "Agent", render: (v) => v.agent.user.name, sortable: true, sortValue: (v) => v.agent.user.name },
    { key: "expected", header: "Attendu", render: (v) => formatFcfa(v.expectedAmount), sortable: true, sortValue: (v) => v.expectedAmount },
    { key: "remitted", header: "Remis", render: (v) => formatFcfa(v.remittedAmount), sortable: true, sortValue: (v) => v.remittedAmount },
    { key: "discrepancy", header: "Ecart", render: (v) => <span className={`font-medium ${v.discrepancy !== 0 ? "text-[var(--color-danger)]" : ""}`}>{formatFcfa(v.discrepancy)}</span>, sortable: true, sortValue: (v) => v.discrepancy },
    { key: "status", header: "Statut", render: (v) => <StatusBadge label={v.status} tone={STATUS_TONE[v.status] ?? "neutral"} />, sortable: true, sortValue: (v) => v.status },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (v) => (v.status === "EN_ATTENTE" || v.status === "ECART") && can(user, "versements", "validate") && <ValidateVersementButtons id={v.id} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Versements"
        description="Remise des especes collectees a la structure habilitee."
        action={
          can(user, "versements", "create") && (
            <VersementForm caisses={caisses.map((c) => ({ id: c.id, label: `${c.number} — ${c.agent.user.name}`, expected: c.expectedAmount ?? 0 }))} />
          )
        }
      />

      <DataTable columns={columns} rows={versements} keyField="id" emptyLabel="Aucun versement enregistre." pageSize={null} />
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/versements?${new URLSearchParams({ page: String(p) })}`} />
    </div>
  );
}
