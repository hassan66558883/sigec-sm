import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listBusinesses } from "@/lib/services/businesses";
import { listCitizens } from "@/lib/services/citizens";
import { BusinessForm } from "@/components/finances/business-form";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Actif", SUSPENDED: "Suspendu", CLOSED: "Ferme" };
const STATUS_CLASS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-[var(--color-success)]",
  SUSPENDED: "bg-amber-100 text-[var(--color-warning)]",
  CLOSED: "bg-gray-100 text-[var(--color-text-muted)]",
};

export default async function BusinessesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "businesses", "view")) redirect("/admin");

  const [businesses, arrondissements, citizens] = await Promise.all([
    listBusinesses(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Commercants & entreprises</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Redevables de patente et taxes municipales.</p>
        </div>
        {can(user, "businesses", "create") && (
          <BusinessForm
            arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
            citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Nom</th>
              <th className="px-4 py-2.5">Activite</th>
              <th className="px-4 py-2.5">Proprietaire</th>
              <th className="px-4 py-2.5">Arrondissement</th>
              <th className="px-4 py-2.5">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {businesses.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-2.5 font-medium">{b.name}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{b.activity || "—"}</td>
                <td className="px-4 py-2.5">{b.owner.firstName} {b.owner.lastName}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{b.arrondissement.name}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                </td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun commerce enregistre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
