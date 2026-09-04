import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listCitizensPage } from "@/lib/services/citizens";
import { CitizenForm } from "@/components/civil-status/citizen-form";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { AdvancedSearchPanel } from "@/components/ui/advanced-search-panel";
import { Pagination } from "@/components/ui/pagination";

type CitizenRow = Awaited<ReturnType<typeof listCitizensPage>>["rows"][number];

export default async function CitizensPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "citizens", "view")) redirect("/admin");
  const { search, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ rows: citizens, total, pageSize }, arrondissements, quartiers] = await Promise.all([
    listCitizensPage(user, search, page),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    prisma.quartier.findMany({
      where: { arrondissement: arrondissementScopeWhere(user) },
      select: { id: true, name: true, arrondissementId: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<CitizenRow>[] = [
    {
      key: "uniqueNumber",
      header: "Numero",
      render: (c) => <span className="text-xs text-[var(--color-text-muted)]">{c.uniqueNumber}</span>,
      sortable: true,
      sortValue: (c) => c.uniqueNumber,
    },
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
      sortable: true,
      sortValue: (c) => `${c.lastName} ${c.firstName}`,
    },
    { key: "sex", header: "Sexe", render: (c) => (c.sex === "M" ? "M" : "F"), sortable: true, sortValue: (c) => c.sex },
    { key: "maritalStatus", header: "Situation", render: (c) => <span className="text-[var(--color-text-muted)]">{c.maritalStatus}</span>, sortable: true, sortValue: (c) => c.maritalStatus },
    {
      key: "arrondissement",
      header: "Arrondissement",
      render: (c) => <span className="text-[var(--color-text-muted)]">{c.arrondissement.name}</span>,
      sortable: true,
      sortValue: (c) => c.arrondissement.name,
    },
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

      <AdvancedSearchPanel action={search && <span className="text-xs text-[var(--color-text-muted)]">Filtre actif : &laquo;{search}&raquo;</span>}>
        <form className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Nom, prenom ou numero de dossier</label>
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="ex: Hassan, ou CIT-2026-..."
              className="w-72 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="rounded-lg px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90" style={{ background: "var(--gradient-primary)" }}>
            Rechercher
          </button>
          {search && (
            <Link href="/admin/citizens" className="rounded-lg border border-[var(--color-border)] px-4 py-1.5 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]">
              Effacer
            </Link>
          )}
        </form>
      </AdvancedSearchPanel>

      <DataTable columns={columns} rows={citizens} keyField="id" emptyLabel="Aucun citoyen enregistre." pageSize={null} />
      <Pagination
        page={page}
        totalPages={totalPages}
        makeHref={(p) => `/admin/citizens?${new URLSearchParams({ ...(search ? { search } : {}), page: String(p) })}`}
      />
    </div>
  );
}
