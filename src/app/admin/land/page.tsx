import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listParcels, listSubdivisions } from "@/lib/services/land";
import { listCitizens } from "@/lib/services/citizens";
import { prisma } from "@/lib/db";
import { ParcelForm } from "@/components/land/parcel-form";
import { SubdivisionForm } from "@/components/land/subdivision-form";
import { IssueTitleButton } from "@/components/land/issue-title-button";

const STATUS_LABEL: Record<string, string> = { AVAILABLE: "Disponible", OCCUPIED: "Occupee", DISPUTED: "Litige", TITLED: "Titree" };
const STATUS_CLASS: Record<string, string> = {
  AVAILABLE: "bg-gray-100 text-[var(--color-text-muted)]",
  OCCUPIED: "bg-amber-100 text-[var(--color-warning)]",
  DISPUTED: "bg-red-100 text-[var(--color-danger)]",
  TITLED: "bg-green-100 text-[var(--color-success)]",
};

export default async function LandPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "land", "view")) redirect("/admin");

  const [parcels, subdivisions, arrondissements, citizens] = await Promise.all([
    listParcels(user),
    listSubdivisions(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
  ]);

  const citizenOptions = citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Foncier</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Parcelles, lotissements et titres fonciers.</p>
        </div>
        {can(user, "land", "create") && (
          <ParcelForm
            arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
            subdivisions={subdivisions.map((s) => ({ id: s.id, label: s.name }))}
            citizens={citizenOptions}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Localisation</th>
              <th className="px-4 py-2.5">Superficie</th>
              <th className="px-4 py-2.5">Occupant</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {parcels.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{p.parcelNumber}</td>
                <td className="px-4 py-2.5">{p.location || "—"}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{p.area ? `${p.area} m²` : "—"}</td>
                <td className="px-4 py-2.5">{p.owner ? `${p.owner.firstName} ${p.owner.lastName}` : "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </td>
                <td className="px-4 py-2.5">
                  {!p.title && can(user, "land", "issue_title") && (
                    <IssueTitleButton parcelId={p.id} citizens={p.owner ? [{ id: p.owner.id, label: `${p.owner.firstName} ${p.owner.lastName}` }] : citizenOptions} />
                  )}
                  {p.title && <span className="text-xs text-[var(--color-text-muted)]">{p.title.titleNumber}</span>}
                </td>
              </tr>
            ))}
            {parcels.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucune parcelle enregistree.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Lotissements</h2>
          {can(user, "land", "create") && <SubdivisionForm arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))} />}
        </div>
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-2.5">Projet</th>
                <th className="px-4 py-2.5">Zone</th>
                <th className="px-4 py-2.5">Arrondissement</th>
                <th className="px-4 py-2.5">Parcelles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {subdivisions.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{s.zone || "—"}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{s.arrondissement.name}</td>
                  <td className="px-4 py-2.5">{s._count.parcels}</td>
                </tr>
              ))}
              {subdivisions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                    Aucun lotissement enregistre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
