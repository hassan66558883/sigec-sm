import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getFinanceSummary } from "@/lib/services/payments";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default async function FinancesDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "payments", "view")) redirect("/admin");

  const summary = await getFinanceSummary(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">
          Recettes municipales {user.hasGlobalScope ? "— Ville de N'Djamena" : ""}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {user.hasGlobalScope
            ? "Vision consolidee : total calcule dynamiquement a partir des recettes reelles de la Mairie Centrale et des 10 arrondissements."
            : "Recettes de votre perimetre uniquement."}
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          {user.hasGlobalScope ? "Total general" : "Total de votre perimetre"}
        </div>
        <div className="mt-1 text-3xl font-semibold text-[var(--color-text)]">{formatFcfa(summary.total)}</div>
      </div>

      {user.hasGlobalScope && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <div className="border-b border-[var(--color-border)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Repartition des recettes</h2>
          </div>
          {summary.arrondissementBreakdown.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Aucune recette enregistree.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
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
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-primary)" }} />
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Recettes par type de taxe</h2>
        </div>
        {summary.taxTypeBreakdown.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Aucune recette enregistree.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
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
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        Le suivi des impayes (factures emises non reglees) et les rapports periodiques (mensuel,
        trimestriel, annuel) necessitent un module de facturation qui n&apos;est pas encore
        implemente — seules les recettes effectivement collectees sont comptabilisees ici.
      </p>
    </div>
  );
}
