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
    <div className="space-y-8">
      <PageHero
        eyebrow="SIGEC-SM"
        title={user?.hasGlobalScope ? "Ville de N'Djamena — Mairie Centrale" : "Tableau de bord d'arrondissement"}
        description={
          user?.hasGlobalScope
            ? `Bienvenue, ${user?.name}. Vision consolidee des 10 arrondissements municipaux.`
            : `Bienvenue, ${user?.name}. Perimetre : ${arrondissements.map((a) => a.name).join(", ") || "aucun arrondissement rattache"}.`
        }
        icon={<IconGauge className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Arrondissements"
          value={arrondissements.length}
          hint={user?.hasGlobalScope ? "sur 10 (N'Djamena)" : "dans votre perimetre"}
          icon={<IconLandmark className="h-5 w-5" />}
          tone="primary"
        />
        <StatCard label="Quartiers" value={quartierTotal} icon={<IconMapPin className="h-5 w-5" />} tone="gold" />
        <StatCard label="Affectations d'utilisateurs" value={userAssignmentTotal} icon={<IconUsersGroup className="h-5 w-5" />} tone="success" />
        {user?.hasGlobalScope ? (
          <StatCard label="Services centraux actifs" value={departmentCount} icon={<IconBuildingOffice className="h-5 w-5" />} tone="warning" />
        ) : (
          <StatCard label="Roles definis" value={roleCount} icon={<IconShieldCheck className="h-5 w-5" />} tone="warning" />
        )}
      </div>

      {financeSummary && revenueOverview && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <IconCoins className="h-4 w-4 text-[var(--color-accent)]" />
            Recettes municipales {user?.hasGlobalScope ? "— Ville de N'Djamena" : "— votre perimetre"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Recettes aujourd'hui" value={formatFcfa(financeSummary.byPeriod.today)} />
            <StatCard label="Recettes ce mois" value={formatFcfa(financeSummary.byPeriod.month)} />
            <StatCard label="Contribuables" value={revenueOverview.citizens} />
            <StatCard label="Boutiques" value={revenueOverview.businesses} />
            <StatCard label="Marches" value={revenueOverview.markets} hint={`${revenueOverview.marketStalls} emplacement(s)`} />
            <StatCard label="Agents actifs" value={revenueOverview.activeAgents} />
            <StatCard label="Obligations impayees" value={revenueOverview.unpaidCount} hint={formatFcfa(revenueOverview.unpaidTotal)} />
            {can(user, "fraud", "view") && (
              <StatCard
                label="Anomalies ouvertes"
                value={revenueOverview.openFraudAlerts}
                hint={
                  <Link href="/admin/fraud" className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline">
                    Voir le controle anti-fraude <IconArrowUpRight className="h-3 w-3" />
                  </Link>
                }
              />
            )}
          </div>
        </div>
      )}

      {recoveryStats && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Recouvrement &amp; paiement en ligne</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Taux de recouvrement" value={`${recoveryStats.recoveryRate}%`} hint={formatFcfa(recoveryStats.totalPaidOnObligations)} tone="success" />
            <StatCard label="Paiements en ligne" value={recoveryStats.online.count} hint={formatFcfa(recoveryStats.online.total)} tone="primary" />
            <StatCard label="Paiements physiques" value={recoveryStats.physical.count} hint={formatFcfa(recoveryStats.physical.total)} tone="gold" />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-3">
          <IconLandmark className="h-4 w-4 text-[var(--color-text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            {user?.hasGlobalScope ? "Repartition par arrondissement" : "Vos arrondissements"}
          </h2>
        </div>
        {arrondissements.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Aucun arrondissement dans votre perimetre.</p>
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
                  {a._count.quartiers} quartier(s) · {a._count.users} utilisateur(s) affecte(s)
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
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Activite recente</h2>
          </div>
          {recentAudit.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Aucune activite enregistree.</p>
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
                  <time className="shrink-0 text-xs text-[var(--color-text-muted)]">
                    {new Date(log.createdAt).toLocaleString("fr-FR")}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)]">
        Tous les modules (etat civil, foncier, recettes municipales, services municipaux) partagent le meme
        mecanisme d&apos;isolation territoriale (voir <code>recordScopeWhere</code>) — aucune donnee d&apos;un
        autre arrondissement n&apos;est jamais exposee.
      </p>
    </div>
  );
}
