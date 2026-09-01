import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listCitizens } from "@/lib/services/citizens";
import { CitizenForm } from "@/components/civil-status/citizen-form";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";

type CitizenRow = Awaited<ReturnType<typeof listCitizens>>[number];

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

  const columns: Column<CitizenRow>[] = [
    { key: "uniqueNumber", header: "Numero", render: (c) => <span className="text-xs text-[var(--color-text-muted)]">{c.uniqueNumber}</span> },
    {
      key: "name",
      header: "Nom",
      render: (c) => (
        <>
          <Link href={`/admin/citizens/${c.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
            {c.firstName} {c.lastName}
          </Link>
          {c.isDeceased && <span className="ms-2 text-xs text-[var(--color-text-muted)]">(decede)</span>}
        </>
      ),
    },
    { key: "sex", header: "Sexe", render: (c) => (c.sex === "M" ? "M" : "F") },
    { key: "maritalStatus", header: "Situation", render: (c) => <span className="text-[var(--color-text-muted)]">{c.maritalStatus}</span> },
    { key: "arrondissement", header: "Arrondissement", render: (c) => <span className="text-[var(--color-text-muted)]">{c.arrondissement.name}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Citoyens"
        description="Dossier numerique unique par citoyen/resident."
        action={
          <>
            {can(user, "citizens", "export") && (
              <a
                href={search ? `/api/citizens/export?search=${encodeURIComponent(search)}` : "/api/citizens/export"}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]"
              >
                Exporter (CSV)
              </a>
            )}
            {can(user, "citizens", "create") && (
              <CitizenForm arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))} quartiers={quartiers} />
            )}
          </>
        }
      />

      <form className="flex gap-2">
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Rechercher par nom ou numero..."
          className="w-72 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]">
          Rechercher
        </button>
      </form>

      <DataTable columns={columns} rows={citizens} keyField="id" emptyLabel="Aucun citoyen enregistre." />
    </div>
  );
}
