import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listCollectors, listEligibleUsers } from "@/lib/services/collectors";
import { listMarkets } from "@/lib/services/markets";
import { CollectorForm } from "@/components/collectors/collector-form";
import { AssignZoneForm } from "@/components/collectors/assign-zone-form";
import { CollectorStatusSelect } from "@/components/collectors/collector-status-select";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Agents collecteurs</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Fiches agents et affectations de zones (section 12), historisees a chaque changement.
          </p>
        </div>
        {can(user, "collectors", "create") && (
          <CollectorForm
            users={eligibleUsers.map((u) => ({ id: u.id, label: `${u.name} (${u.email})` }))}
            arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
          />
        )}
      </div>

      <div className="space-y-3">
        {collectors.map((agent) => (
          <div key={agent.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
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
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${agent.status === "ACTIF" ? "bg-green-100 text-[var(--color-success)]" : "bg-gray-100 text-[var(--color-text-muted)]"}`}>
                    {agent.status}
                  </span>
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
          </div>
        ))}
        {collectors.length === 0 && (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)]">
            Aucun agent collecteur enregistre.
          </p>
        )}
      </div>
    </div>
  );
}
