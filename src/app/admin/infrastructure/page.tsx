import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listInfrastructureForStaff } from "@/lib/services/infrastructure";
import { StatusSelect } from "@/components/municipal/status-select";

const TYPE_LABEL: Record<string, string> = {
  ROAD: "Route", LIGHTING: "Eclairage", DRAINAGE: "Caniveau", WASTE: "Dechets", PUBLIC_SPACE: "Espace public", OTHER: "Autre",
};
const STATUS_LABEL: Record<string, string> = { REPORTED: "Signale", IN_PROGRESS: "En cours", COMPLETED: "Termine" };
const STATUS_CLASS: Record<string, string> = {
  REPORTED: "bg-amber-100 text-[var(--color-warning)]",
  IN_PROGRESS: "bg-amber-100 text-[var(--color-warning)]",
  COMPLETED: "bg-green-100 text-[var(--color-success)]",
};

export default async function InfrastructurePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "infrastructure", "view")) redirect("/admin");

  const reports = await listInfrastructureForStaff(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Voirie & infrastructures</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Signalements de problemes de voirie, eclairage, proprete...</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Description</th>
              <th className="px-4 py-2.5">Localisation</th>
              <th className="px-4 py-2.5">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {reports.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{r.reportNumber}</td>
                <td className="px-4 py-2.5">{TYPE_LABEL[r.type]}</td>
                <td className="px-4 py-2.5">{r.description}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{r.location || "—"}</td>
                <td className="px-4 py-2.5">
                  {can(user, "infrastructure", "update") ? (
                    <StatusSelect
                      endpoint={`/api/infrastructure/${r.id}`}
                      value={r.status}
                      options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
                      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}
                    />
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  )}
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun signalement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
