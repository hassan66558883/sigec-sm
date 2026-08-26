import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { arrondissementScopeWhere, can } from "@/lib/rbac";
import { listAuditLogs } from "@/lib/audit";
import { getFinanceSummary } from "@/lib/services/payments";
import { getMunicipalRevenueOverview } from "@/lib/services/dashboard";
import { getRecoveryStats } from "@/lib/services/analytics";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { getI18n } from "@/lib/i18n/server";
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
} from "@/components/icons";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length >= 2 ? [parts[0][0], parts[1][0]] : [name.slice(0, 2)]).join("").toUpperCase();
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

  const [arrondissements, roleCount, departmentCount, recentAudit, financeSummary, revenueOverview, recoveryStats] = await Promise.all([
    prisma.arrondissement.findMany({
      where: scopeWhere,
      orderBy: { number: "asc" },
      include: { _count: { select: { quartiers: true, users: true } } },
    }),
    prisma.role.count(),
    prisma.department.count({ where: { isActive: true } }),
    canViewAudit ? listAuditLogs(user, undefined, 8) : Promise.resolve([]),
    canViewRevenue && user ? getFinanceSummary(user) : Promise.resolve(null),
    canViewRevenue && user ? getMunicipalRevenueOverview(user) : Promise.resolve(null),
    user ? getRecoveryStats(user) : Promise.resolve(null),
  ]);

  const quartierTotal = arrondissements.reduce((sum, a) => sum + a._count.quartiers, 0);
  const userAssignmentTotal = arrondissements.reduce((sum, a) => sum + a._count.users, 0);

  return (
    <div dir={dir} lang={locale} className="space-y-8">
      <PageHero
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

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-3">
          <IconLandmark className="h-4 w-4 text-[var(--color-text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            {user?.hasGlobalScope ? t("dashboard.arrondissementBreakdownGlobal") : t("dashboard.arrondissementBreakdownScoped")}
          </h2>
        </div>
        {arrondissements.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">{t("dashboard.noArrondissements")}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {arrondissements.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm transition hover:bg-[var(--color-primary-light)]/50">
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
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-3">
            <IconActivity className="h-4 w-4 text-[var(--color-text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">{t("dashboard.recentActivity")}</h2>
          </div>
          {recentAudit.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">{t("dashboard.noActivity")}</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {recentAudit.map((log) => (
                <li key={log.id} className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-[var(--color-primary-light)]/50">
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
