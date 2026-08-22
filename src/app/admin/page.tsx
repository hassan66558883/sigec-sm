import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { arrondissementScopeWhere, can } from "@/lib/rbac";
import { listAuditLogs } from "@/lib/audit";

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
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

  const [arrondissements, roleCount, departmentCount, recentAudit] = await Promise.all([
    prisma.arrondissement.findMany({
      where: scopeWhere,
      orderBy: { number: "asc" },
      include: { _count: { select: { quartiers: true, users: true } } },
    }),
    prisma.role.count(),
    prisma.department.count({ where: { isActive: true } }),
    canViewAudit ? listAuditLogs(user, undefined, 8) : Promise.resolve([]),
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
        Les modules Etat civil, Foncier, Finances (recettes/taxes par arrondissement) et Services municipaux
        seront ajoutes lors des phases suivantes, en reutilisant le meme mecanisme d&apos;isolation
        territoriale (voir <code>recordScopeWhere</code>).
      </p>
    </div>
  );
}
