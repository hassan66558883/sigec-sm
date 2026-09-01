import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getFinanceSummary, getRevenueTrend } from "@/lib/services/payments";
import { PageHeading } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ChartCard } from "@/components/ui/chart-card";
import { Card, CardHeader } from "@/components/ui/card";
import { LineTrendChart } from "@/components/admin/charts/line-trend-chart";
import { chartColors } from "@/components/admin/charts/chart-colors";
import { IconCoins, IconLandmark } from "@/components/icons";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

const METHOD_LABEL: Record<string, string> = {
  ESPECES: "Especes",
  MOBILE_MONEY: "Mobile Money",
  VIREMENT: "Virement",
  CARTE: "Carte",
  EN_LIGNE: "En ligne",
  AUTRE: "Autre",
};

export default async function FinancesDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "payments", "view")) redirect("/admin");

  const [summary, revenueTrend] = await Promise.all([getFinanceSummary(user), getRevenueTrend(user, 12)]);

  return (
    <div className="space-y-6">
      <PageHeading
        title={`Recettes municipales ${user.hasGlobalScope ? "— Ville de N'Djamena" : ""}`}
        description={
          user.hasGlobalScope
            ? "Vision consolidee : total calcule dynamiquement a partir des recettes reelles de la Mairie Centrale et des 10 arrondissements."
            : "Recettes de votre perimetre uniquement."
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label={user.hasGlobalScope ? "Total general" : "Total de votre perimetre"} value={formatFcfa(summary.total)} icon={<IconCoins className="h-5 w-5" />} tone="primary" />
        <StatCard label="Aujourd'hui" value={formatFcfa(summary.byPeriod.today)} />
        <StatCard label="Ce mois-ci" value={formatFcfa(summary.byPeriod.month)} tone="gold" />
        <StatCard label="Cette annee" value={formatFcfa(summary.byPeriod.year)} tone="success" />
      </div>

      {revenueTrend.length > 0 && (
        <ChartCard title="Evolution des recettes" subtitle="Recettes mensuelles, 12 derniers mois" icon={<IconCoins className="h-4 w-4" />}>
          <LineTrendChart data={revenueTrend} series={[{ key: "recettes", label: "Recettes", color: chartColors.accent }]} valueFormat="thousandsFcfa" />
        </ChartCard>
      )}

      {summary.byPaymentMethodToday.length > 0 && (
        <Card padding="p-0">
          <CardHeader title="Recettes du jour par mode de paiement" icon={<IconCoins className="h-4 w-4" />} />
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
            {summary.byPaymentMethodToday
              .sort((a, b) => b.total - a.total)
              .map((row) => (
                <div key={row.method} className="rounded-lg border border-[var(--color-border-subtle)] p-3 text-center">
                  <div className="text-sm font-semibold text-[var(--color-text)]">{formatFcfa(row.total)}</div>
                  <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{METHOD_LABEL[row.method] ?? row.method}</div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {user.hasGlobalScope && (
        <Card padding="p-0">
          <CardHeader title="Repartition des recettes" icon={<IconLandmark className="h-4 w-4" />} />
          {summary.arrondissementBreakdown.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Aucune recette enregistree.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border-subtle)]">
              {summary.arrondissementBreakdown
                .sort((a, b) => b.total - a.total)
                .map((row) => {
                  const pct = summary.total > 0 ? Math.round((row.total / summary.total) * 100) : 0;
                  return (
                    <li key={row.arrondissementId ?? "central"} className="px-5 py-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className={row.arrondissementId ? "" : "font-semibold"}>{row.name}</span>
                        <span className="font-medium">{formatFcfa(row.total)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--gradient-primary)" }} />
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </Card>
      )}

      <Card padding="p-0">
        <CardHeader title="Recettes par type de taxe" />
        {summary.taxTypeBreakdown.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Aucune recette enregistree.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {summary.taxTypeBreakdown
              .sort((a, b) => b.total - a.total)
              .map((row) => (
                <li key={row.taxTypeId ?? "other"} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span>{row.name}</span>
                  <span className="font-medium">{formatFcfa(row.total)}</span>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-[var(--color-text-muted)]">
        Le suivi des impayes (factures emises non reglees) necessite un module de facturation qui
        n&apos;est pas encore implemente — seules les recettes effectivement collectees sont
        comptabilisees ici.
      </p>
    </div>
  );
}
