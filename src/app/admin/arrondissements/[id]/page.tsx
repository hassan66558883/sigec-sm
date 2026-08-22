import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, canAccessArrondissement } from "@/lib/rbac";
import { listQuartiers } from "@/lib/services/territorial";
import { QuartierForm } from "@/components/territorial/quartier-form";
import { ToggleActiveButton } from "@/components/toggle-active-button";

export default async function ArrondissementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const arrondissement = await prisma.arrondissement.findUnique({ where: { id }, include: { city: true } });
  if (!arrondissement) notFound();
  // L'arrondissement existe bien : un acces hors perimetre est un refus
  // d'autorisation (403), pas une absence de ressource (404).
  if (!canAccessArrondissement(user, id)) forbidden();

  const quartiers = await listQuartiers(user, id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/arrondissements" className="text-xs text-[var(--color-primary)] hover:underline">
          ← Arrondissements
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-[var(--color-text)]">
          {arrondissement.name} <span className="text-[var(--color-text-muted)]">({arrondissement.code})</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{arrondissement.city.name}</p>
      </div>

      {can(user, "territorial", "create") && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Ajouter un quartier</h2>
          <QuartierForm arrondissementId={id} />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Quartier</th>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Secteurs</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {quartiers.map((q) => (
              <tr key={q.id}>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/quartiers/${q.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                    {q.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                  {q.code}
                  {q.sourceReference && <span className="ml-1" title={q.sourceReference}>⚠</span>}
                </td>
                <td className="px-4 py-2.5">{q._count.sectors}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      q.isActive ? "bg-green-100 text-[var(--color-success)]" : "bg-gray-100 text-[var(--color-text-muted)]"
                    }`}
                  >
                    {q.isActive ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {can(user, "territorial", "edit") && (
                    <ToggleActiveButton endpoint={`/api/quartiers/${q.id}`} isActive={q.isActive} />
                  )}
                </td>
              </tr>
            ))}
            {quartiers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun quartier enregistre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
