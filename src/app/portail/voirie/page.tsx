import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { listMyReports } from "@/lib/services/infrastructure";
import { InfraForm } from "./infra-form";
import { PageHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

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
      <PageHeading title="Signaler un probleme de voirie" description="Routes, eclairage, caniveaux, dechets, espaces publics..." />

      <Card>
        <InfraForm />
      </Card>

      <div className="space-y-3">
        {reports.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">
                  {r.reportNumber} — {TYPE_LABEL[r.type]}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">{r.description}</div>
              </div>
              <StatusBadge label={STATUS_LABEL[r.status]} tone="neutral" />
            </div>
          </Card>
        ))}
        {reports.length === 0 && (
          <Card>
            <EmptyState title="Aucun signalement." />
          </Card>
        )}
      </div>
    </div>
  );
}
