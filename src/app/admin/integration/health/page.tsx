import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listSystemsHealth } from "@/lib/services/integration-health";
import { RunHealthCheckButton } from "@/components/integration/run-health-check-button";
import { PageHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

const LEVEL_ICON: Record<string, string> = { HEALTHY: "🟢", DEGRADED: "🟡", OFFLINE: "🔴", UNKNOWN: "⚪" };
const LEVEL_LABEL: Record<string, string> = { HEALTHY: "Healthy", DEGRADED: "Degraded", OFFLINE: "Offline", UNKNOWN: "No data yet" };

export default async function IntegrationHealthPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "health")) redirect("/admin/integration");

  const systemsHealth = await listSystemsHealth(user);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Integration Health"
        description="Etat de disponibilite reel de chaque systeme connecte, calcule sur les 20 dernieres verifications (Test Connection manuel + verification periodique automatique)."
      />

      {systemsHealth.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Aucun systeme actif.</p>}

      <div className="space-y-4">
        {systemsHealth.map(({ system, health }) => (
          <Card key={system.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-[var(--color-text)]">
                  {LEVEL_ICON[health.level]} {system.name} <span className="text-xs text-[var(--color-text-muted)]">({LEVEL_LABEL[health.level]})</span>
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{system.code} — {system.type}</p>
              </div>
              {system.baseUrl && <RunHealthCheckButton systemId={system.id} />}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <p className="text-[var(--color-text-muted)]">Uptime</p>
                <p className="font-medium">{health.uptimePct !== null ? `${health.uptimePct}%` : "—"}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">Avg Latency</p>
                <p className="font-medium">{health.avgLatencyMs !== null ? `${health.avgLatencyMs} ms` : "—"}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">Last Success</p>
                <p className="font-medium">{health.lastSuccess ? new Date(health.lastSuccess).toLocaleString("fr-FR") : "—"}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">Last Failure</p>
                <p className="font-medium">{health.lastFailure ? new Date(health.lastFailure).toLocaleString("fr-FR") : "—"}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
