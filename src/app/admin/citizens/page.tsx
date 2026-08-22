import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listCitizens } from "@/lib/services/citizens";
import { CitizenForm } from "@/components/civil-status/citizen-form";

export default async function CitizensPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "citizens", "view")) redirect("/admin");
  const { search } = await searchParams;

  const [citizens, arrondissements, quartiers] = await Promise.all([
    listCitizens(user, search),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    prisma.quartier.findMany({
      where: { arrondissement: arrondissementScopeWhere(user) },
      select: { id: true, name: true, arrondissementId: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Citoyens</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Dossier numerique unique par citoyen/resident.</p>
        </div>
        <div className="flex items-center gap-2">
          {can(user, "citizens", "export") && (
            <a
              href={search ? `/api/citizens/export?search=${encodeURIComponent(search)}` : "/api/citizens/export"}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-gray-50"
            >
              Exporter (CSV)
            </a>
          )}
          {can(user, "citizens", "create") && (
            <CitizenForm arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))} quartiers={quartiers} />
          )}
        </div>
      </div>

      <form className="flex gap-2">
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Rechercher par nom ou numero..."
          className="w-72 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Rechercher
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Nom</th>
              <th className="px-4 py-2.5">Sexe</th>
              <th className="px-4 py-2.5">Situation</th>
              <th className="px-4 py-2.5">Arrondissement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {citizens.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{c.uniqueNumber}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/citizens/${c.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                  {c.isDeceased && <span className="ml-2 text-xs text-[var(--color-text-muted)]">(decede)</span>}
                </td>
                <td className="px-4 py-2.5">{c.sex === "M" ? "M" : "F"}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{c.maritalStatus}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{c.arrondissement.name}</td>
              </tr>
            ))}
            {citizens.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun citoyen enregistre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
