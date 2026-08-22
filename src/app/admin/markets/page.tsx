import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listMarkets } from "@/lib/services/markets";
import { listCitizens } from "@/lib/services/citizens";
import { MarketForm } from "@/components/finances/market-form";
import { StallPanel } from "@/components/finances/stall-panel";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Marches municipaux</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Emplacements, boutiques et etals.</p>
        </div>
        {can(user, "markets", "create") && <MarketForm arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))} />}
      </div>

      <div className="space-y-4">
        {markets.map((m) => (
          <div key={m.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text)]">{m.name}</h2>
                <p className="text-xs text-[var(--color-text-muted)]">{m.arrondissement.name}</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">{m.stalls.length} emplacement(s)</span>
            </div>
            <StallPanel marketId={m.id} stalls={m.stalls} citizens={citizenOptions} canManage={can(user, "markets", "create")} />
          </div>
        ))}
        {markets.length === 0 && (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)] shadow-sm">
            Aucun marche enregistre.
          </p>
        )}
      </div>
    </div>
  );
}
