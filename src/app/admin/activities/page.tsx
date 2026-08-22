import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listActivities } from "@/lib/services/activities";
import { ActivityForm } from "@/components/finances/activity-form";
import { ToggleActiveButton } from "@/components/toggle-active-button";

export default async function ActivitiesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "tariffs", "view")) redirect("/admin");

  const activities = await listActivities();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Activites economiques</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Referentiel des activites (module recensement) utilise pour classer boutiques et tarifs.
          </p>
        </div>
        {can(user, "tariffs", "create") && <ActivityForm />}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Nom</th>
              <th className="px-4 py-2.5">Description</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {activities.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{a.code}</td>
                <td className="px-4 py-2.5 font-medium">{a.name}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{a.description ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.isActive ? "bg-green-100 text-[var(--color-success)]" : "bg-gray-100 text-[var(--color-text-muted)]"}`}>
                    {a.isActive ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {can(user, "tariffs", "edit") && <ToggleActiveButton endpoint={`/api/activities/${a.id}`} isActive={a.isActive} />}
                </td>
              </tr>
            ))}
            {activities.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">Aucune activite enregistree.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
