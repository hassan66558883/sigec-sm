import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listHouseholds } from "@/lib/services/households";
import { HouseholdForm } from "@/components/civil-status/household-form";

export default async function HouseholdsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "households", "view")) redirect("/admin");

  const [households, arrondissements] = await Promise.all([
    listHouseholds(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Menages</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Unites de cohabitation rattachees a une adresse.</p>
        </div>
        {can(user, "households", "create") && (
          <HouseholdForm arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))} />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Adresse</th>
              <th className="px-4 py-2.5">Arrondissement</th>
              <th className="px-4 py-2.5">Membres</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {households.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{h.code}</td>
                <td className="px-4 py-2.5">{h.address || "—"}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{h.arrondissement.name}</td>
                <td className="px-4 py-2.5">{h._count.members}</td>
              </tr>
            ))}
            {households.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun menage enregistre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
