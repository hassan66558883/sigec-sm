import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { arrondissementScopeWhere, can } from "@/lib/rbac";
import { listAuditLogs } from "@/lib/audit";
import { getFinanceSummary } from "@/lib/services/payments";
import { getMunicipalRevenueOverview } from "@/lib/services/dashboard";
import { getRecoveryStats } from "@/lib/services/analytics";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</div>}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
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
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">
          {user?.hasGlobalScope ? "Ville de N'Djamena — Mairie Centrale" : "Tableau de bord d'arrondissement"}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Bienvenue, {user?.name}.{" "}
          {user?.hasGlobalScope
            ? "Vision consolidee des 10 arrondissements municipaux."
            : `Perimetre : ${arrondissements.map((a) => a.name).join(", ") || "aucun arrondissement rattache"}.`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Arrondissements"
          value={arrondissements.length}
          hint={user?.hasGlobalScope ? "sur 10 (N'Djamena)" : "dans votre perimetre"}
        />
        <StatCard label="Quartiers" value={quartierTotal} />
        <StatCard label="Affectations d'utilisateurs" value={userAssignmentTotal} />
        {user?.hasGlobalScope ? (
          <StatCard label="Services centraux actifs" value={departmentCount} />
        ) : (
          <StatCard label="Roles definis" value={roleCount} />
        )}
      </div>

      {financeSummary && revenueOverview && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">
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
                hint={<Link href="/admin/fraud" className="hover:underline">Voir le controle anti-fraude →</Link>}
              />
            )}
          </div>
        </div>
      )}

      {recoveryStats && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Recouvrement & paiement en ligne</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Taux de recouvrement" value={`${recoveryStats.recoveryRate}%`} hint={formatFcfa(recoveryStats.totalPaidOnObligations)} />
            <StatCard label="Paiements en ligne" value={recoveryStats.online.count} hint={formatFcfa(recoveryStats.online.total)} />
            <StatCard label="Paiements physiques" value={recoveryStats.physical.count} hint={formatFcfa(recoveryStats.physical.total)} />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            {user?.hasGlobalScope ? "Repartition par arrondissement" : "Vos arrondissements"}
          </h2>
        </div>
        {arrondissements.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Aucun arrondissement dans votre perimetre.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {arrondissements.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <Link href={`/admin/arrondissements/${a.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                  {a.name} <span className="font-normal text-[var(--color-text-muted)]">({a.code})</span>
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
          <div className="border-b border-[var(--color-border)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Activite recente</h2>
          </div>
          {recentAudit.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Aucune activite enregistree.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {recentAudit.map((log) => (
                <li key={log.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <span className="font-medium text-[var(--color-text)]">{log.userName}</span>{" "}
                    <span className="text-[var(--color-text-muted)]">
                      {log.action.toLowerCase()} — {log.module}
                      {log.entityType ? ` / ${log.entityType}` : ""}
                    </span>
                  </div>
                  <time className="text-xs text-[var(--color-text-muted)]">
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
