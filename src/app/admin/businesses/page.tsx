import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listBusinessesPage } from "@/lib/services/businesses";
import { listCitizens } from "@/lib/services/citizens";
import { listActivities } from "@/lib/services/activities";
import { BusinessForm } from "@/components/finances/business-form";
import { BusinessStatusSelect } from "@/components/finances/business-status-select";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  FERMEE: "Ferme",
  SUSPENDUE: "Suspendu",
  EN_ATTENTE_DE_VALIDATION: "En attente",
};
const STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  FERMEE: "neutral",
  SUSPENDUE: "warning",
  EN_ATTENTE_DE_VALIDATION: "warning",
};

type BusinessRow = Awaited<ReturnType<typeof listBusinessesPage>>["rows"][number];

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "businesses", "view")) redirect("/admin");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ rows: businesses, total, pageSize }, arrondissements, citizens, activities] = await Promise.all([
    listBusinessesPage(user, page),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
    listActivities(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<BusinessRow>[] = [
    {
      key: "code",
      header: "Code",
      render: (b) => (
        <Link href={`/admin/businesses/${b.id}`} className="text-xs text-[var(--color-primary)] hover:underline">
          {b.code ?? "—"}
        </Link>
      ),
      sortable: true,
      sortValue: (b) => b.code ?? "",
    },
    {
      key: "name",
      header: "Nom",
      render: (b) => (
        <Link href={`/admin/businesses/${b.id}`} className="font-medium hover:underline">
          {b.name}
        </Link>
      ),
      sortable: true,
      sortValue: (b) => b.name,
    },
    { key: "activity", header: "Activite", render: (b) => <span className="text-[var(--color-text-muted)]">{b.activityRef?.name ?? b.activity ?? "—"}</span>, sortable: true, sortValue: (b) => b.activityRef?.name ?? b.activity ?? "" },
    { key: "owner", header: "Proprietaire", render: (b) => <>{b.owner.firstName} {b.owner.lastName}</>, sortable: true, sortValue: (b) => `${b.owner.lastName} ${b.owner.firstName}` },
    { key: "arrondissement", header: "Arrondissement", render: (b) => <span className="text-[var(--color-text-muted)]">{b.arrondissement.name}</span>, sortable: true, sortValue: (b) => b.arrondissement.name },
    {
      key: "status",
      header: "Statut",
      render: (b) =>
        can(user, "businesses", "edit") ? (
          <BusinessStatusSelect id={b.id} status={b.status} />
        ) : (
          <StatusBadge label={STATUS_LABEL[b.status] ?? b.status} tone={STATUS_TONE[b.status] ?? "neutral"} />
        ),
      sortable: true,
      sortValue: (b) => b.status,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Boutiques & commercants"
        description="Redevables de patente et taxes municipales (module recensement)."
        action={
          can(user, "businesses", "create") && (
            <BusinessForm
              arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
              citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
              activities={activities.map((a) => ({ id: a.id, label: a.name }))}
            />
          )
        }
      />

      <DataTable columns={columns} rows={businesses} keyField="id" emptyLabel="Aucune boutique enregistree." pageSize={null} />
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/businesses?${new URLSearchParams({ page: String(p) })}`} />
    </div>
  );
}
