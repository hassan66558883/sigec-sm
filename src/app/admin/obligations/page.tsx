import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listObligationsPage } from "@/lib/services/obligations";
import { listCitizens } from "@/lib/services/citizens";
import { listBusinesses } from "@/lib/services/businesses";
import { listMarkets } from "@/lib/services/markets";
import { listTariffs } from "@/lib/services/tariffs";
import { ObligationForm } from "@/components/obligations/obligation-form";
import { ReasonActionButton } from "@/components/finances/reason-action-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

const STATUS_LABEL: Record<string, string> = {
  A_PAYER: "A payer",
  PARTIELLEMENT_PAYE: "Partiellement paye",
  PAYE: "Paye",
  EN_RETARD: "En retard",
  ANNULE: "Annule",
};

type ObligationRow = Awaited<ReturnType<typeof listObligationsPage>>["rows"][number];

export default async function ObligationsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "obligations", "view")) redirect("/admin");
  const { status, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ rows: obligations, total, pageSize }, citizens, businesses, markets, tariffs] = await Promise.all([
    listObligationsPage(user, { status }, page),
    listCitizens(user),
    listBusinesses(user),
    listMarkets(user),
    listTariffs(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const stalls = markets.flatMap((m) => m.stalls.map((s) => ({ id: s.id, label: `${m.name} — ${s.code}` })));

  const columns: Column<ObligationRow>[] = [
    { key: "number", header: "Numero", render: (o) => <span className="text-xs text-[var(--color-text-muted)]">{o.number}</span>, sortable: true, sortValue: (o) => o.number },
    { key: "citizen", header: "Contribuable", render: (o) => <>{o.citizen.firstName} {o.citizen.lastName}</>, sortable: true, sortValue: (o) => `${o.citizen.lastName} ${o.citizen.firstName}` },
    { key: "period", header: "Periode", render: (o) => <span className="text-[var(--color-text-muted)]">{o.period}</span>, sortable: true, sortValue: (o) => o.period },
    { key: "amount", header: "Montant", render: (o) => <span className="font-medium">{formatFcfa(o.initialAmount)}</span>, sortable: true, sortValue: (o) => o.initialAmount },
    {
      key: "balance",
      header: "Solde",
      render: (o) => <span className={`font-medium ${o.balance > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}>{formatFcfa(o.balance)}</span>,
      sortable: true,
      sortValue: (o) => o.balance,
    },
    { key: "dueDate", header: "Echeance", render: (o) => <span className="text-xs text-[var(--color-text-muted)]">{new Date(o.dueDate).toLocaleDateString("fr-FR")}</span>, sortable: true, sortValue: (o) => new Date(o.dueDate).getTime() },
    { key: "status", header: "Statut", render: (o) => <StatusBadge label={STATUS_LABEL[o.status] ?? o.status} tone="neutral" />, sortable: true, sortValue: (o) => o.status },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (o) =>
        can(user, "obligations", "cancel") && o.status !== "ANNULE" && o.paidAmount === 0 && (
          <ReasonActionButton endpoint={`/api/obligations/${o.id}`} action="cancel" label="Annuler" />
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Obligations de paiement"
        description="Sommes dues generees a partir du referentiel tarifaire — le solde n'est jamais negatif."
        action={
          can(user, "obligations", "create") && (
            <ObligationForm
              citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
              businesses={businesses.map((b) => ({ id: b.id, label: b.name }))}
              stalls={stalls}
              tariffs={tariffs.map((t) => ({ id: t.id, label: `${t.label} — ${formatFcfa(t.amount)}` }))}
            />
          )
        }
      />

      <div className="flex flex-wrap gap-2 text-xs">
        {["", "A_PAYER", "PARTIELLEMENT_PAYE", "PAYE", "EN_RETARD", "ANNULE"].map((s) => {
          const active = (status ?? "") === s;
          return (
            <a
              key={s || "all"}
              href={s ? `/admin/obligations?status=${s}` : "/admin/obligations"}
              className={`rounded-full px-3 py-1 font-medium transition ${active ? "text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"}`}
              style={active ? { background: "var(--gradient-primary)" } : undefined}
            >
              {s ? STATUS_LABEL[s] : "Toutes"}
            </a>
          );
        })}
      </div>

      <DataTable columns={columns} rows={obligations} keyField="id" emptyLabel="Aucune obligation enregistree." pageSize={null} />
      <Pagination
        page={page}
        totalPages={totalPages}
        makeHref={(p) => `/admin/obligations?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`}
      />
    </div>
  );
}
