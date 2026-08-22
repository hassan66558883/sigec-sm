import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listArrondissements } from "@/lib/services/territorial";
import { ArrondissementForm } from "@/components/territorial/arrondissement-form";
import { ToggleActiveButton } from "@/components/toggle-active-button";

export default async function ArrondissementsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "territorial", "view")) redirect("/admin");

  const [arrondissements, cities] = await Promise.all([
    listArrondissements(user),
    prisma.city.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Arrondissements & quartiers</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Structure territoriale : ville → arrondissements → quartiers → secteurs/zones.
          </p>
        </div>
        {can(user, "territorial", "export") && (
          <a
            href="/api/arrondissements/export"
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-gray-50"
          >
            Exporter (CSV)
          </a>
        )}
      </div>

      {can(user, "territorial", "create") && cities[0] && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">
            Ajouter un arrondissement — {cities[0].name}
          </h2>
          <ArrondissementForm cityId={cities[0].id} />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">N°</th>
              <th className="px-4 py-2.5">Nom</th>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Quartiers</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {arrondissements.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5">{a.number}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/arrondissements/${a.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                    {a.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{a.code}</td>
                <td className="px-4 py-2.5">{a._count.quartiers}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.isActive ? "bg-green-100 text-[var(--color-success)]" : "bg-gray-100 text-[var(--color-text-muted)]"
                    }`}
                  >
                    {a.isActive ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {can(user, "territorial", "edit") && (
                    <ToggleActiveButton endpoint={`/api/arrondissements/${a.id}`} isActive={a.isActive} />
                  )}
                </td>
              </tr>
            ))}
            {arrondissements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun arrondissement dans votre perimetre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
