import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listHouseholdsPage } from "@/lib/services/households";
import { HouseholdForm } from "@/components/civil-status/household-form";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type HouseholdRow = Awaited<ReturnType<typeof listHouseholdsPage>>["rows"][number];

export default async function HouseholdsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "households", "view")) redirect("/admin");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ rows: households, total, pageSize }, arrondissements] = await Promise.all([
    listHouseholdsPage(user, page),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<HouseholdRow>[] = [
    { key: "code", header: "Code", render: (h) => <span className="text-xs text-[var(--color-text-muted)]">{h.code}</span>, sortable: true, sortValue: (h) => h.code },
    { key: "address", header: "Adresse", render: (h) => h.address || "—", sortable: true, sortValue: (h) => h.address || "" },
    { key: "arrondissement", header: "Arrondissement", render: (h) => <span className="text-[var(--color-text-muted)]">{h.arrondissement.name}</span>, sortable: true, sortValue: (h) => h.arrondissement.name },
    { key: "members", header: "Membres", render: (h) => h._count.members, sortable: true, sortValue: (h) => h._count.members },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Menages"
        description="Unites de cohabitation rattachees a une adresse."
        action={can(user, "households", "create") && <HouseholdForm arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))} />}
      />

      <DataTable columns={columns} rows={households} keyField="id" emptyLabel="Aucun menage enregistre." pageSize={null} />
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/households?${new URLSearchParams({ page: String(p) })}`} />
    </div>
  );
}
