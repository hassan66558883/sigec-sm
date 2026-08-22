import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTariffs } from "@/lib/services/tariffs";
import { listActivities } from "@/lib/services/activities";
import { TariffForm } from "@/components/finances/tariff-form";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default async function TariffsPage({ searchParams }: { searchParams: Promise<{ history?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "tariffs", "view")) redirect("/admin");
  const { history } = await searchParams;
  const includeHistory = history === "1";

  const [tariffs, activities] = await Promise.all([listTariffs(includeHistory), listActivities()]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Tarification municipale</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Referentiel des tarifs (section 10) — jamais modifie en place : toute revision cree une nouvelle version.
          </p>
        </div>
        {can(user, "tariffs", "create") && <TariffForm activities={activities.map((a) => ({ id: a.id, label: a.name }))} />}
      </div>

      <div className="flex gap-2 text-xs">
        <a href="/admin/tariffs" className={`rounded-full px-3 py-1 font-medium ${!includeHistory ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
          Tarifs actifs
        </a>
        <a href="/admin/tariffs?history=1" className={`rounded-full px-3 py-1 font-medium ${includeHistory ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
          Historique complet
        </a>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Libelle</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Periodicite</th>
              <th className="px-4 py-2.5">Montant</th>
              <th className="px-4 py-2.5">Validite</th>
              <th className="px-4 py-2.5">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {tariffs.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{t.code}</td>
                <td className="px-4 py-2.5 font-medium">{t.label}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{t.emplacementType}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{t.periodicity}</td>
                <td className="px-4 py-2.5 font-medium">{formatFcfa(t.amount)}</td>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
                  {new Date(t.startDate).toLocaleDateString("fr-FR")}
                  {t.endDate ? ` → ${new Date(t.endDate).toLocaleDateString("fr-FR")}` : ""}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.status === "ACTIF" ? "bg-green-100 text-[var(--color-success)]" : "bg-gray-100 text-[var(--color-text-muted)]"}`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
            {tariffs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--color-text-muted)]">Aucun tarif enregistre.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
