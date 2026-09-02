import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listArrondissements } from "@/lib/services/territorial";
import { getArrondissementStatsReport } from "@/lib/services/analytics";
import { ArrondissementForm } from "@/components/territorial/arrondissement-form";
import { ToggleActiveButton } from "@/components/toggle-active-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ChartCard } from "@/components/ui/chart-card";
import { BarTrendChart } from "@/components/admin/charts/bar-trend-chart";
import { chartColors } from "@/components/admin/charts/chart-colors";
import { IconLandmark, IconUsersGroup, IconCoins, IconActivity } from "@/components/icons";

type ArrondissementRow = Awaited<ReturnType<typeof listArrondissements>>[number];

export default async function ArrondissementsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "territorial", "view")) redirect("/admin");

  const [arrondissements, cities, stats] = await Promise.all([
    listArrondissements(user),
    prisma.city.findMany({ orderBy: { name: "asc" } }),
    getArrondissementStatsReport(user),
  ]);

  const hasPopulation = stats.some((s) => s.population !== null);
  const totalPopulation = stats.reduce((sum, s) => sum + (s.population ?? 0), 0);
  const totalNaissances = stats.reduce((sum, s) => sum + (s.naissances ?? 0), 0);
  const totalRecettes = stats.reduce((sum, s) => sum + (s.recettes ?? 0), 0);

  const ranking = [...stats].filter((s) => s.population !== null).sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  const columns: Column<ArrondissementRow>[] = [
    { key: "number", header: "N°", render: (a) => a.number, sortable: true, sortValue: (a) => a.number },
    {
      key: "name",
      header: "Nom",
      render: (a) => (
        <Link href={`/admin/arrondissements/${a.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
          {a.name}
        </Link>
      ),
      sortable: true,
      sortValue: (a) => a.name,
    },
    { key: "code", header: "Code", render: (a) => <span className="text-[var(--color-text-muted)]">{a.code}</span>, sortable: true, sortValue: (a) => a.code },
    { key: "quartiers", header: "Quartiers", render: (a) => a._count.quartiers, sortable: true, sortValue: (a) => a._count.quartiers },
    { key: "status", header: "Statut", render: (a) => <StatusBadge label={a.isActive ? "Actif" : "Inactif"} tone={a.isActive ? "success" : "neutral"} />, sortable: true, sortValue: (a) => (a.isActive ? "Actif" : "Inactif") },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (a) => can(user, "territorial", "edit") && <ToggleActiveButton endpoint={`/api/arrondissements/${a.id}`} isActive={a.isActive} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Performance des arrondissements"
        description="Vue comparee des 10 arrondissements de la Ville de N'Djamena."
        action={
          can(user, "territorial", "export") && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- telechargement de fichier (route API), pas une page a naviguer
            <a
              href="/api/arrondissements/export"
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]"
            >
              Exporter (CSV)
            </a>
          )
        }
      />

      {hasPopulation && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Arrondissements" value={arrondissements.length} icon={<IconLandmark className="h-5 w-5" />} />
            <StatCard label="Population totale" value={totalPopulation.toLocaleString("fr-FR")} icon={<IconUsersGroup className="h-5 w-5" />} tone="success" />
            <StatCard label="Naissances (total)" value={totalNaissances} icon={<IconActivity className="h-5 w-5" />} tone="gold" />
            <StatCard label="Recettes totales" value={`${totalRecettes.toLocaleString("fr-FR")} FCFA`} icon={<IconCoins className="h-5 w-5" />} tone="warning" />
          </div>

          <ChartCard title="Classement par population" subtitle="Population enregistree par arrondissement" icon={<IconUsersGroup className="h-4 w-4" />} height="h-96">
            <BarTrendChart
              data={ranking.map((r) => ({ name: `${r.name} (${r.code})`, population: r.population ?? 0 }))}
              series={[{ key: "population", label: "Population", color: chartColors.primary }]}
              xKey="name"
              layout="horizontal-bars"
            />
          </ChartCard>
        </>
      )}

      {can(user, "territorial", "create") && cities[0] && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Ajouter un arrondissement — {cities[0].name}</h2>
          <ArrondissementForm cityId={cities[0].id} />
        </div>
      )}

      <DataTable columns={columns} rows={arrondissements} keyField="id" emptyLabel="Aucun arrondissement dans votre perimetre." />
    </div>
  );
}
