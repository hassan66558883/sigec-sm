import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listSectors } from "@/lib/services/territorial";
import { SectorForm } from "@/components/territorial/sector-form";

export default async function QuartierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const quartier = await prisma.quartier.findUnique({ where: { id }, include: { arrondissement: true } });
  if (!quartier) notFound();

  const sectors = await listSectors(user, id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/arrondissements/${quartier.arrondissementId}`}
          className="text-xs text-[var(--color-primary)] hover:underline"
        >
          ← {quartier.arrondissement.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-[var(--color-text)]">
          {quartier.name} <span className="text-[var(--color-text-muted)]">({quartier.code})</span>
        </h1>
      </div>

      {can(user, "territorial", "create") && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Ajouter un secteur/zone</h2>
          <SectorForm quartierId={id} />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Secteur/Zone</th>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {sectors.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2.5">{s.name}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{s.code}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.isActive ? "bg-green-100 text-[var(--color-success)]" : "bg-gray-100 text-[var(--color-text-muted)]"
                    }`}
                  >
                    {s.isActive ? "Actif" : "Inactif"}
                  </span>
                </td>
              </tr>
            ))}
            {sectors.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun secteur enregistre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
