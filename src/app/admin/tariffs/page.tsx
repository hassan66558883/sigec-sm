import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTariffs } from "@/lib/services/tariffs";
import { listActivities } from "@/lib/services/activities";
import { listArrondissements } from "@/lib/services/territorial";
import { TariffForm } from "@/components/finances/tariff-form";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

type TariffRow = Awaited<ReturnType<typeof listTariffs>>[number];

export default async function TariffsPage({ searchParams }: { searchParams: Promise<{ history?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "tariffs", "view")) redirect("/admin");
  const { history } = await searchParams;
  const includeHistory = history === "1";

  const [tariffs, activities, arrondissements] = await Promise.all([
    listTariffs(includeHistory),
    listActivities(),
    listArrondissements(user),
  ]);

  const columns: Column<TariffRow>[] = [
    { key: "code", header: "Code", render: (t) => <span className="text-xs text-[var(--color-text-muted)]">{t.code}</span> },
    { key: "label", header: "Libelle", render: (t) => <span className="font-medium">{t.label}</span> },
    { key: "type", header: "Type", render: (t) => <span className="text-[var(--color-text-muted)]">{t.emplacementType}</span> },
    { key: "periodicity", header: "Periodicite", render: (t) => <span className="text-[var(--color-text-muted)]">{t.periodicity}</span> },
    { key: "amount", header: "Montant", render: (t) => <span className="font-medium">{formatFcfa(t.amount)}</span> },
    { key: "unit", header: "Unite", render: (t) => <span className="text-xs text-[var(--color-text-muted)]">{t.unit ?? "—"}</span> },
    { key: "arrondissement", header: "Arrondissement", render: (t) => <span className="text-xs text-[var(--color-text-muted)]">{t.arrondissement?.name ?? "Toute la ville"}</span> },
    {
      key: "validity",
      header: "Validite",
      render: (t) => (
        <span className="text-xs text-[var(--color-text-muted)]">
          {new Date(t.startDate).toLocaleDateString("fr-FR")}
          {t.endDate ? ` → ${new Date(t.endDate).toLocaleDateString("fr-FR")}` : ""}
        </span>
      ),
    },
    { key: "status", header: "Statut", render: (t) => <StatusBadge label={t.status} tone={t.status === "ACTIF" ? "success" : "neutral"} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Tarification municipale"
        description="Referentiel des tarifs — jamais modifie en place : toute revision cree une nouvelle version."
        action={
          can(user, "tariffs", "create") && (
            <TariffForm
              activities={activities.map((a) => ({ id: a.id, label: a.name }))}
              arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
            />
          )
        }
      />

      <div className="flex gap-2 text-xs">
        <a href="/admin/tariffs" className={`rounded-full px-3 py-1 font-medium transition ${!includeHistory ? "text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"}`} style={!includeHistory ? { background: "var(--gradient-primary)" } : undefined}>
          Tarifs actifs
        </a>
        <a href="/admin/tariffs?history=1" className={`rounded-full px-3 py-1 font-medium transition ${includeHistory ? "text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"}`} style={includeHistory ? { background: "var(--gradient-primary)" } : undefined}>
          Historique complet
        </a>
      </div>

      <DataTable columns={columns} rows={tariffs} keyField="id" emptyLabel="Aucun tarif enregistre." />
    </div>
  );
}
