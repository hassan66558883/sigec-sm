import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listCollectors, listEligibleUsers } from "@/lib/services/collectors";
import { listMarkets } from "@/lib/services/markets";
import { CollectorForm } from "@/components/collectors/collector-form";
import { AssignZoneForm } from "@/components/collectors/assign-zone-form";
import { CollectorStatusSelect } from "@/components/collectors/collector-status-select";
import { PageHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function CollectorsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "collectors", "view")) redirect("/admin");

  const [collectors, eligibleUsers, arrondissements, quartiers, markets] = await Promise.all([
    listCollectors(user),
    listEligibleUsers(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    prisma.quartier.findMany({ where: { arrondissement: arrondissementScopeWhere(user) }, orderBy: { name: "asc" } }),
    listMarkets(user),
  ]);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Agents collecteurs"
        description="Fiches agents et affectations de zones, historisees a chaque changement."
        action={
          can(user, "collectors", "create") && (
            <CollectorForm
              users={eligibleUsers.map((u) => ({ id: u.id, label: `${u.name} (${u.email})` }))}
              arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
            />
          )
        }
      />

      <div className="space-y-3">
        {collectors.map((agent) => (
          <Card key={agent.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{agent.user.name}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {agent.matricule} — {agent.arrondissement.name}
                  {agent.phone ? ` — ${agent.phone}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {can(user, "collectors", "edit") ? (
                  <CollectorStatusSelect id={agent.id} status={agent.status} />
                ) : (
                  <StatusBadge label={agent.status} tone={agent.status === "ACTIF" ? "success" : "neutral"} />
                )}
              </div>
            </div>

            <div className="mt-2 text-xs text-[var(--color-text-muted)]">
              Zones actives :{" "}
              {agent.affectations.length === 0
                ? "aucune"
                : agent.affectations.map((a) => (a.zoneType === "QUARTIER" ? a.quartier?.name : a.market?.name)).join(", ")}
            </div>

            {can(user, "collectors", "assign") && (
              <AssignZoneForm
                agentId={agent.id}
                quartiers={quartiers.map((q) => ({ id: q.id, label: q.name }))}
                markets={markets.map((m) => ({ id: m.id, label: m.name }))}
              />
            )}
          </Card>
        ))}
        {collectors.length === 0 && (
          <Card>
            <EmptyState title="Aucun agent collecteur enregistre." />
          </Card>
        )}
      </div>
    </div>
  );
}
