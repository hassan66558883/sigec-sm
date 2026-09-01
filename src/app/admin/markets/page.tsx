import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listMarkets } from "@/lib/services/markets";
import { listCitizens } from "@/lib/services/citizens";
import { MarketForm } from "@/components/finances/market-form";
import { StallPanel } from "@/components/finances/stall-panel";
import { MarketStatusSelect } from "@/components/finances/market-status-select";
import { PageHeading } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBuildingOffice, IconMapPin, IconUsersGroup } from "@/components/icons";

export default async function MarketsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "markets", "view")) redirect("/admin");

  const [markets, arrondissements, citizens] = await Promise.all([
    listMarkets(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
  ]);

  const citizenOptions = citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` }));

  const allStalls = markets.flatMap((m) => m.stalls);
  const occupied = allStalls.filter((s) => s.status === "OCCUPIED").length;
  const available = allStalls.filter((s) => s.status === "AVAILABLE").length;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Marches municipaux"
        description="Emplacements, boutiques et etals."
        action={can(user, "markets", "create") && <MarketForm arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))} />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Marches" value={markets.length} icon={<IconBuildingOffice className="h-5 w-5" />} />
        <StatCard label="Emplacements" value={allStalls.length} icon={<IconMapPin className="h-5 w-5" />} tone="gold" />
        <StatCard label="Occupes" value={occupied} icon={<IconUsersGroup className="h-5 w-5" />} tone="success" />
        <StatCard label="Disponibles" value={available} tone="warning" />
      </div>

      <div className="space-y-4">
        {markets.map((m) => (
          <Card key={m.id}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text)]">{m.name}</h2>
                <p className="text-xs text-[var(--color-text-muted)]">{m.code ?? "—"} — {m.arrondissement.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--color-text-muted)]">{m.stalls.length} emplacement(s)</span>
                {can(user, "markets", "edit") ? (
                  <MarketStatusSelect id={m.id} status={m.status} />
                ) : (
                  <span className="text-xs text-[var(--color-text-muted)]">{m.status}</span>
                )}
              </div>
            </div>
            <StallPanel marketId={m.id} stalls={m.stalls} citizens={citizenOptions} canManage={can(user, "markets", "create")} />
          </Card>
        ))}
        {markets.length === 0 && (
          <Card>
            <EmptyState title="Aucun marche enregistre." />
          </Card>
        )}
      </div>
    </div>
  );
}
