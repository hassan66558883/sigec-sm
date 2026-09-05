import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { arrondissementScopeWhere, can } from "@/lib/rbac";
import { listAuditLogs } from "@/lib/audit";
import { getFinanceSummary, getRevenueTrend, getQrRevenueToday } from "@/lib/services/payments";
import { getMunicipalRevenueOverview } from "@/lib/services/dashboard";
import { getRecoveryStats, getPopulationTrend, getCivilStatusTrend, getArrondissementStatsReport } from "@/lib/services/analytics";
import { getReconciliationHealthSummary } from "@/lib/services/reconciliation";
import { cached, scopeCacheKey } from "@/lib/cache";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ChartCard } from "@/components/ui/chart-card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { chartColors } from "@/components/admin/charts/chart-colors";
import { getI18n } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n/translate";
import {
  IconGauge,
  IconMapPin,
  IconUsersGroup,
  IconLandmark,
  IconCoins,
  IconBuildingOffice,
  IconShieldCheck,
  IconActivity,
  IconArrowUpRight,
  IconArrowDownRight,
} from "@/components/icons";

import { LineTrendChart } from "@/components/admin/charts/line-trend-chart";
import { BarTrendChart } from "@/components/admin/charts/bar-trend-chart";

type Tr = (key: TranslationKey, vars?: Record<string, string | number>) => string;

// Fraicheur acceptable pour les agregats de tableau de bord (voir
// src/lib/cache.ts) — pas de donnee critique en jeu, seulement des
// compteurs/tendances affiches en lecture.
const DASHBOARD_CACHE_TTL_MS = 60_000;

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length >= 2 ? [parts[0][0], parts[1][0]] : [name.slice(0, 2)]).join("").toUpperCase();
}

function trendBadge(pct: number, label: string) {
  if (pct === 0) return undefined;
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
      {up ? <IconArrowUpRight className="h-3 w-3" /> : <IconArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}
      {pct}% {label}
    </span>
  );
}

// Chaque section de tendance est un composant serveur async independant,
// enveloppe dans son propre <Suspense> (voir le rendu principal) :
// deliberement PAS regroupe dans le Promise.all rapide existant, pour que
// ces nouvelles requetes $queryRaw (plus lourdes que les compteurs simples
// deja affiches) ne ralentissent jamais le premier rendu du tableau de
// bord.
async function PopulationTrendCard({ user, t }: { user: CurrentUser; t: Tr }) {
  const data = await cached(`dashboard:populationTrend:${scopeCacheKey(user)}`, DASHBOARD_CACHE_TTL_MS, () => getPopulationTrend(user, 12));
  if (data.length === 0) {
    return (
      <ChartCard title={t("dashboard.populationTrendTitle")} subtitle={t("dashboard.populationTrendSubtitle")} icon={<IconUsersGroup className="h-4 w-4" />} isEmpty>
        <span />
      </ChartCard>
    );
  }
  const last = data[data.length - 1].population;
  const prev = data.length > 1 ? data[data.length - 2].population : last;
  const pct = prev > 0 ? Math.round(((last - prev) / prev) * 1000) / 10 : 0;
  return (
    <ChartCard
      title={t("dashboard.populationTrendTitle")}
      subtitle={t("dashboard.populationTrendSubtitle")}
      icon={<IconUsersGroup className="h-4 w-4" />}
      action={trendBadge(pct, t("dashboard.trendVsLastMonth"))}
    >
      <LineTrendChart data={data} series={[{ key: "population", label: t("dashboard.statPopulation"), color: chartColors.primary }]} valueFormat="number" />
    </ChartCard>
  );
}

async function CivilStatusTrendCard({ user, t }: { user: CurrentUser; t: Tr }) {
  const data = await cached(`dashboard:civilStatusTrend:${scopeCacheKey(user)}`, DASHBOARD_CACHE_TTL_MS, () => getCivilStatusTrend(user, 12));
  const first = data[0];
  const series = first
    ? [
        "naissances" in first && { key: "naissances", label: t("sidebar.births"), color: chartColors.primary },
        "mariages" in first && { key: "mariages", label: t("sidebar.marriages"), color: chartColors.accent },
        "deces" in first && { key: "deces", label: t("sidebar.deaths"), color: chartColors.danger },
        "certificats" in first && { key: "certificats", label: t("sidebar.certificates"), color: chartColors.success },
      ].filter((s): s is { key: string; label: string; color: string } => Boolean(s))
    : [];

  return (
    <ChartCard
      title={t("dashboard.civilStatusTrendTitle")}
      subtitle={t("dashboard.civilStatusTrendSubtitle")}
      icon={<IconActivity className="h-4 w-4" />}
      isEmpty={series.length === 0}
    >
      {series.length > 0 && <BarTrendChart data={data} series={series} />}
    </ChartCard>
  );
}

async function RevenueTrendCard({ user, t }: { user: CurrentUser; t: Tr }) {
  const data = await cached(`dashboard:revenueTrend:${scopeCacheKey(user)}`, DASHBOARD_CACHE_TTL_MS, () => getRevenueTrend(user, 12));
  if (data.length === 0) {
    return (
      <ChartCard title={t("dashboard.revenueTrendTitle")} subtitle={t("dashboard.revenueTrendSubtitle")} icon={<IconCoins className="h-4 w-4" />} isEmpty>
        <span />
      </ChartCard>
    );
  }
  const last = data[data.length - 1].recettes;
  const prev = data.length > 1 ? data[data.length - 2].recettes : last;
  const pct = prev > 0 ? Math.round(((last - prev) / prev) * 1000) / 10 : 0;
  return (
    <ChartCard
      title={t("dashboard.revenueTrendTitle")}
      subtitle={t("dashboard.revenueTrendSubtitle")}
      icon={<IconCoins className="h-4 w-4" />}
      action={trendBadge(pct, t("dashboard.trendVsLastMonth"))}
    >
      <LineTrendChart data={data} series={[{ key: "recettes", label: t("dashboard.revenueTrendTitle"), color: chartColors.accent }]} valueFormat="thousandsFcfa" />
    </ChartCard>
  );
}

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  const { locale, dir, t } = await getI18n();

  // Un compte TECHNOTCHAD (aucun acces aux modules municipaux) n'a rien a
  // faire sur le tableau de bord municipal — evite d'exposer des agregats
  // territoriaux (arrondissements/quartiers/affectations) a un role qui ne
  // devrait voir que l'espace commercial (regle 23).
  if (user && !can(user, "territorial", "view") && can(user, "technotchad_clients", "view")) {
    redirect("/admin/technotchad");
  }

  const scopeWhere = arrondissementScopeWhere(user);

  const canViewAudit = can(user, "audit", "view");
  const canViewRevenue = can(user, "payments", "view");

  const canViewReconciliation = can(user, "reconciliation", "view");

  const [arrondissements, roleCount, departmentCount, recentAudit, financeSummary, revenueOverview, recoveryStats, arrondissementStats, reconciliationHealth, qrRevenueToday] =
    await Promise.all([
      prisma.arrondissement.findMany({
        where: scopeWhere,
        orderBy: { number: "asc" },
        include: { _count: { select: { quartiers: true, users: true } } },
      }),
      prisma.role.count(),
      prisma.department.count({ where: { isActive: true } }),
      canViewAudit ? listAuditLogs(user, undefined, 8) : Promise.resolve([]),
      canViewRevenue && user
        ? cached(`dashboard:financeSummary:${scopeCacheKey(user)}`, DASHBOARD_CACHE_TTL_MS, () => getFinanceSummary(user))
        : Promise.resolve(null),
      canViewRevenue && user
        ? cached(`dashboard:revenueOverview:${scopeCacheKey(user)}`, DASHBOARD_CACHE_TTL_MS, () => getMunicipalRevenueOverview(user))
        : Promise.resolve(null),
      user ? cached(`dashboard:recoveryStats:${scopeCacheKey(user)}`, DASHBOARD_CACHE_TTL_MS, () => getRecoveryStats(user)) : Promise.resolve(null),
      user
        ? cached(`dashboard:arrondissementStats:${scopeCacheKey(user)}`, DASHBOARD_CACHE_TTL_MS, () => getArrondissementStatsReport(user))
        : Promise.resolve([]),
      canViewReconciliation && user
        ? cached(`dashboard:reconciliationHealth:${scopeCacheKey(user)}`, DASHBOARD_CACHE_TTL_MS, () => getReconciliationHealthSummary(user))
        : Promise.resolve(null),
      canViewRevenue && user
        ? cached(`dashboard:qrRevenueToday:${scopeCacheKey(user)}`, DASHBOARD_CACHE_TTL_MS, () => getQrRevenueToday(user))
        : Promise.resolve(null),
    ]);

  const quartierTotal = arrondissements.reduce((sum, a) => sum + a._count.quartiers, 0);
  const userAssignmentTotal = arrondissements.reduce((sum, a) => sum + a._count.users, 0);

  const ranking = arrondissementStats
    .filter((r) => r.population !== null)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  const maxPopulation = ranking.length > 0 ? Math.max(...ranking.map((r) => r.population ?? 0), 1) : 1;

  return (
    <div dir={dir} lang={locale} className="space-y-8">
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={user?.hasGlobalScope ? t("dashboard.titleGlobal") : t("dashboard.titleScoped")}
        description={
          user?.hasGlobalScope
            ? t("dashboard.welcomeGlobal", { name: user?.name ?? "" })
            : t("dashboard.welcomeScoped", {
                name: user?.name ?? "",
                scope: arrondissements.map((a) => a.name).join(", ") || t("dashboard.noScope"),
              })
        }
        icon={<IconGauge className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.statArrondissements")}
          value={arrondissements.length}
          hint={user?.hasGlobalScope ? t("dashboard.hintOf10") : t("dashboard.hintInScope")}
          icon={<IconLandmark className="h-5 w-5" />}
          tone="primary"
        />
        <StatCard label={t("dashboard.statQuartiers")} value={quartierTotal} icon={<IconMapPin className="h-5 w-5" />} tone="gold" />
        <StatCard label={t("dashboard.statUserAssignments")} value={userAssignmentTotal} icon={<IconUsersGroup className="h-5 w-5" />} tone="success" />
        {user?.hasGlobalScope ? (
          <StatCard label={t("dashboard.statActiveCentralServices")} value={departmentCount} icon={<IconBuildingOffice className="h-5 w-5" />} tone="warning" />
        ) : (
          <StatCard label={t("dashboard.statDefinedRoles")} value={roleCount} icon={<IconShieldCheck className="h-5 w-5" />} tone="warning" />
        )}
      </div>

      {financeSummary && revenueOverview && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <IconCoins className="h-4 w-4 text-[var(--color-accent)]" />
            {user?.hasGlobalScope ? t("dashboard.revenueTitleGlobal") : t("dashboard.revenueTitleScoped")}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label={t("dashboard.statRevenueToday")} value={formatFcfa(financeSummary.byPeriod.today)} />
            <StatCard label={t("dashboard.statRevenueMonth")} value={formatFcfa(financeSummary.byPeriod.month)} />
            <StatCard label={t("dashboard.statTaxpayers")} value={revenueOverview.citizens} />
            <StatCard label={t("dashboard.statBusinesses")} value={revenueOverview.businesses} />
            <StatCard label={t("dashboard.statMarkets")} value={revenueOverview.markets} hint={t("dashboard.hintEmplacements", { count: revenueOverview.marketStalls })} />
            <StatCard label={t("dashboard.statActiveAgents")} value={revenueOverview.activeAgents} />
            <StatCard label={t("dashboard.statUnpaidObligations")} value={revenueOverview.unpaidCount} hint={formatFcfa(revenueOverview.unpaidTotal)} />
            {can(user, "fraud", "view") && (
              <StatCard
                label={t("dashboard.statOpenFraud")}
                value={revenueOverview.openFraudAlerts}
                hint={
                  <Link href="/admin/fraud" className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline">
                    {t("dashboard.viewFraud")} <IconArrowUpRight className="h-3 w-3" />
                  </Link>
                }
              />
            )}
            {qrRevenueToday && (
              <StatCard
                label={t("dashboard.statQrRevenueToday")}
                value={formatFcfa(qrRevenueToday.total)}
                hint={t("dashboard.hintQrPaymentsCount", { count: qrRevenueToday.count })}
                tone="primary"
              />
            )}
            {reconciliationHealth && (
              <StatCard
                label={t("dashboard.statReconciliationDiscrepancies")}
                value={reconciliationHealth.openDiscrepancies}
                tone={reconciliationHealth.openDiscrepancies > 0 ? "danger" : "success"}
                hint={
                  <Link href="/admin/reconciliation" className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline">
                    {t("dashboard.viewReconciliation")} <IconArrowUpRight className="h-3 w-3" />
                  </Link>
                }
              />
            )}
          </div>
        </div>
      )}

      {recoveryStats && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{t("dashboard.recoveryTitle")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label={t("dashboard.statRecoveryRate")} value={`${recoveryStats.recoveryRate}%`} hint={formatFcfa(recoveryStats.totalPaidOnObligations)} tone="success" />
            <StatCard label={t("dashboard.statOnlinePayments")} value={recoveryStats.online.count} hint={formatFcfa(recoveryStats.online.total)} tone="primary" />
            <StatCard label={t("dashboard.statPhysicalPayments")} value={recoveryStats.physical.count} hint={formatFcfa(recoveryStats.physical.total)} tone="gold" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Suspense fallback={<SkeletonCard />}>
          <PopulationTrendCard user={user!} t={t} />
        </Suspense>
        <Suspense fallback={<SkeletonCard />}>
          <CivilStatusTrendCard user={user!} t={t} />
        </Suspense>
        {canViewRevenue && (
          <div className="lg:col-span-2">
            <Suspense fallback={<SkeletonCard />}>
              <RevenueTrendCard user={user!} t={t} />
            </Suspense>
          </div>
        )}
      </div>

      {ranking.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-5 py-3.5">
            <IconLandmark className="h-4 w-4 text-[var(--color-text-muted)]" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">{t("dashboard.rankingTitle")}</h2>
              <p className="text-xs text-[var(--color-text-muted)]">{t("dashboard.rankingSubtitle")}</p>
            </div>
          </div>
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {ranking.map((r, index) => (
              <li key={r.id}>
                <Link href={`/admin/arrondissements/${r.id}`} className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-[var(--color-surface-hover)]">
                  <span className="w-5 shrink-0 text-xs font-semibold text-[var(--color-text-muted)]">{index + 1}</span>
                  <span className="w-40 shrink-0 truncate font-medium text-[var(--color-text)]">
                    {r.name} <span className="font-normal text-[var(--color-text-muted)]">({r.code})</span>
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.max(4, Math.round(((r.population ?? 0) / maxPopulation) * 100))}%`, background: "var(--gradient-primary)" }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-end text-xs font-semibold text-[var(--color-text)]">{(r.population ?? 0).toLocaleString("fr-FR")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-5 py-3">
          <IconLandmark className="h-4 w-4 text-[var(--color-text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            {user?.hasGlobalScope ? t("dashboard.arrondissementBreakdownGlobal") : t("dashboard.arrondissementBreakdownScoped")}
          </h2>
        </div>
        {arrondissements.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">{t("dashboard.noArrondissements")}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {arrondissements.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm transition hover:bg-[var(--color-surface-hover)]">
                <Link href={`/admin/arrondissements/${a.id}`} className="flex items-center gap-3 font-medium text-[var(--color-text)]">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    {String(a.number).padStart(2, "0")}
                  </span>
                  <span className="group-hover:underline">
                    {a.name} <span className="font-normal text-[var(--color-text-muted)]">({a.code})</span>
                  </span>
                </Link>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {t("dashboard.quartierUserSuffix", { q: a._count.quartiers, u: a._count.users })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canViewAudit && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-5 py-3">
            <IconActivity className="h-4 w-4 text-[var(--color-text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">{t("dashboard.recentActivity")}</h2>
          </div>
          {recentAudit.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">{t("dashboard.noActivity")}</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border-subtle)]">
              {recentAudit.map((log) => (
                <li key={log.id} className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-[var(--color-surface-hover)]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[10px] font-semibold text-[var(--color-primary)]">
                    {initials(log.userName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-[var(--color-text)]">{log.userName}</span>{" "}
                    <span className="text-[var(--color-text-muted)]">
                      {log.action.toLowerCase()} — {log.module}
                      {log.entityType ? ` / ${log.entityType}` : ""}
                    </span>
                  </div>
                  <time className="shrink-0 text-xs text-[var(--color-text-muted)]" dir="ltr">
                    {new Date(log.createdAt).toLocaleString("fr-FR")}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)]">{t("dashboard.footerNote")}</p>
    </div>
  );
}
