import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { listMyReports } from "@/lib/services/infrastructure";
import { InfraForm } from "./infra-form";

const TYPE_LABEL: Record<string, string> = {
  ROAD: "Route", LIGHTING: "Eclairage", DRAINAGE: "Caniveau", WASTE: "Dechets", PUBLIC_SPACE: "Espace public", OTHER: "Autre",
};
const STATUS_LABEL: Record<string, string> = { REPORTED: "Signale", IN_PROGRESS: "En cours", COMPLETED: "Termine" };

export default async function MyInfraReportsPage() {
  const account = await getCurrentCitizenAccount();
  if (!account) return null;

  const reports = await listMyReports(account);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Signaler un probleme de voirie</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Routes, eclairage, caniveaux, dechets, espaces publics...</p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <InfraForm />
      </div>

      <div className="space-y-3">
        {reports.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
            <div>
              <div className="text-sm font-medium">{r.reportNumber} — {TYPE_LABEL[r.type]}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{r.description}</div>
            </div>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
              {STATUS_LABEL[r.status]}
            </span>
          </div>
        ))}
        {reports.length === 0 && (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)] shadow-sm">
            Aucun signalement.
          </p>
        )}
      </div>
    </div>
  );
}
