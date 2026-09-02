import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getPopulationStats, getCivilStatusStats, getServicesStats } from "@/lib/services/analytics";
import { PageHeading } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ChartCard } from "@/components/ui/chart-card";
import { BarTrendChart } from "@/components/admin/charts/bar-trend-chart";
import { chartColors } from "@/components/admin/charts/chart-colors";
import { IconUsersGroup, IconActivity, IconClipboardList } from "@/components/icons";

const CIVIL_STATUS_LABELS: Record<string, string> = {
  births: "Naissances",
  marriages: "Mariages",
  divorces: "Divorces",
  deaths: "Deces",
  recognitions: "Reconnaissances",
  certificates: "Certificats delivres",
};

const APPLICATION_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Soumise", IN_REVIEW: "En traitement", APPROVED: "Approuvee", REJECTED: "Rejetee", COMPLETED: "Terminee",
};
const COMPLAINT_STATUS_LABEL: Record<string, string> = {
  NEW: "Nouveau", RECEIVED: "Recu", ASSIGNED: "Affecte", IN_PROGRESS: "En traitement",
  PENDING: "En attente", RESOLVED: "Resolu", CLOSED: "Cloture",
};
const URBAN_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Soumise", UNDER_REVIEW: "En instruction", INSPECTED: "Controlee", APPROVED: "Approuvee", REJECTED: "Rejetee",
};
const PARCEL_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponible", OCCUPIED: "Occupee", DISPUTED: "Litige", TITLED: "Titree",
};
const MARITAL_STATUS_LABEL: Record<string, string> = { SINGLE: "Celibataire", MARRIED: "Marie(e)", DIVORCED: "Divorce(e)", WIDOWED: "Veuf/veuve" };

function BreakdownChart({ rows, labels, title }: { rows: { status: string; count: number }[]; labels: Record<string, string>; title: string }) {
  const data = rows.map((r) => ({ category: labels[r.status] ?? r.status, count: r.count }));
  return (
    <ChartCard title={title} icon={<IconClipboardList className="h-4 w-4" />} height="h-64" isEmpty={rows.length === 0} emptyLabel="Aucune donnee.">
      <BarTrendChart data={data} series={[{ key: "count", label: title, color: chartColors.primary }]} xKey="category" layout="horizontal-bars" />
    </ChartCard>
  );
}

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const canPopulation = can(user, "citizens", "view");
  const [population, civilStatus, services] = await Promise.all([
    canPopulation ? getPopulationStats(user) : null,
    getCivilStatusStats(user),
    getServicesStats(user),
  ]);

  const hasCivilStatusData = Object.values(civilStatus).some((v) => v !== null);
  const hasServicesData = Object.values(services).some((v) => v !== null);

  const civilStatusChartData = Object.entries(civilStatus)
    .filter(([, v]) => v !== null)
    .map(([key, v]) => ({ category: CIVIL_STATUS_LABELS[key], total: v!.total, thisYear: v!.thisYear }));

  return (
    <div className="space-y-8">
      <PageHeading
        title={`Statistiques ${user.hasGlobalScope ? "— Ville de N'Djamena" : ""}`}
        description="Rapports consolides, calcules dynamiquement a partir des donnees reelles de votre perimetre."
      />

      {population && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Citoyens enregistres" value={population.total} icon={<IconUsersGroup className="h-5 w-5" />} tone="primary" />
          <StatCard label="Menages" value={population.households} icon={<IconUsersGroup className="h-5 w-5" />} tone="gold" />
          {population.bySex.map((r) => (
            <StatCard key={r.sex} label={r.sex === "M" ? "Hommes" : "Femmes"} value={r.count} tone={r.sex === "M" ? "primary" : "success"} />
          ))}
        </div>
      )}

      {population && (population.byMaritalStatus.length > 0 || population.arrondissementBreakdown.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {population.byMaritalStatus.length > 0 && (
            <BreakdownChart title="Situation matrimoniale" rows={population.byMaritalStatus.map((r) => ({ status: r.status, count: r.count }))} labels={MARITAL_STATUS_LABEL} />
          )}
          {population.arrondissementBreakdown.length > 0 && (
            <ChartCard title="Population par arrondissement" icon={<IconUsersGroup className="h-4 w-4" />} height="h-64">
              <BarTrendChart
                data={[...population.arrondissementBreakdown].sort((a, b) => b.count - a.count).map((r) => ({ category: r.name, count: r.count }))}
                series={[{ key: "count", label: "Population", color: chartColors.accent }]}
                xKey="category"
                layout="horizontal-bars"
              />
            </ChartCard>
          )}
        </div>
      )}

      {hasCivilStatusData && (
        <ChartCard title="Etat civil — total vs cette annee" icon={<IconActivity className="h-4 w-4" />} height="h-72">
          <BarTrendChart
            data={civilStatusChartData}
            series={[
              { key: "total", label: "Total", color: chartColors.muted },
              { key: "thisYear", label: "Cette annee", color: chartColors.primary },
            ]}
            xKey="category"
          />
        </ChartCard>
      )}

      {hasServicesData && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {services.applications && <BreakdownChart title="Demandes citoyennes" rows={services.applications} labels={APPLICATION_STATUS_LABEL} />}
          {services.complaints && <BreakdownChart title="Plaintes" rows={services.complaints} labels={COMPLAINT_STATUS_LABEL} />}
          {services.urbanCases && <BreakdownChart title="Dossiers d'urbanisme" rows={services.urbanCases} labels={URBAN_STATUS_LABEL} />}
          {services.parcels && <BreakdownChart title="Parcelles" rows={services.parcels} labels={PARCEL_STATUS_LABEL} />}
        </div>
      )}

      {!population && !hasCivilStatusData && !hasServicesData && (
        <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)] shadow-sm">
          Aucune statistique disponible pour votre niveau de permission.
        </p>
      )}
    </div>
  );
}
