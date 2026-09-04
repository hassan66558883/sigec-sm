import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listBirthRecordsPage, getBirthsPeriodStats } from "@/lib/services/births";
import { listCitizens } from "@/lib/services/citizens";
import { DeclareBirthForm } from "@/components/civil-status/declare-birth-form";
import { ValidateButton } from "@/components/civil-status/validate-button";
import { RevokeButton } from "@/components/civil-status/revoke-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { IconActivity } from "@/components/icons";

const STATUS_LABEL: Record<string, string> = {
  DECLARED: "Declaree",
  REGISTERED: "Enregistree",
  ANNULLED: "Annulee",
};
const STATUS_TONE: Record<string, StatusTone> = {
  DECLARED: "warning",
  REGISTERED: "success",
  ANNULLED: "neutral",
};

type BirthRow = Awaited<ReturnType<typeof listBirthRecordsPage>>["rows"][number];

export default async function BirthsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "births", "view")) redirect("/admin");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ rows: records, total, pageSize }, arrondissements, citizens, periodStats] = await Promise.all([
    listBirthRecordsPage(user, page),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
    getBirthsPeriodStats(user),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<BirthRow>[] = [
    { key: "recordNumber", header: "Numero", render: (r) => <span className="text-xs text-[var(--color-text-muted)]">{r.recordNumber}</span>, sortable: true, sortValue: (r) => r.recordNumber },
    {
      key: "child",
      header: "Enfant",
      render: (r) => (
        <Link href={`/admin/births/${r.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
          {r.child.firstName} {r.child.lastName}
        </Link>
      ),
      sortable: true,
      sortValue: (r) => `${r.child.lastName} ${r.child.firstName}`,
    },
    { key: "date", header: "Date", render: (r) => <span className="text-[var(--color-text-muted)]">{new Date(r.dateOfBirth).toLocaleDateString("fr-FR")}</span>, sortable: true, sortValue: (r) => new Date(r.dateOfBirth).getTime() },
    { key: "status", header: "Statut", render: (r) => <StatusBadge label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />, sortable: true, sortValue: (r) => STATUS_LABEL[r.status] },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (r) => (
        <div className="flex justify-end gap-2">
          {r.status === "DECLARED" && can(user, "births", "validate") && <ValidateButton endpoint={`/api/births/${r.id}`} />}
          {r.status !== "ANNULLED" && can(user, "births", "revoke") && <RevokeButton endpoint={`/api/births/${r.id}`} />}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Naissances"
        description="Declaration et enregistrement des actes de naissance."
        action={
          can(user, "births", "create") && (
            <DeclareBirthForm
              arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
              citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
            />
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Aujourd'hui" value={periodStats.today} icon={<IconActivity className="h-5 w-5" />} />
        <StatCard label="Cette semaine" value={periodStats.week} icon={<IconActivity className="h-5 w-5" />} tone="gold" />
        <StatCard label="Ce mois" value={periodStats.month} icon={<IconActivity className="h-5 w-5" />} tone="success" />
        <StatCard label="Cette annee" value={periodStats.year} icon={<IconActivity className="h-5 w-5" />} tone="warning" />
      </div>

      <DataTable columns={columns} rows={records} keyField="id" emptyLabel="Aucune declaration de naissance." pageSize={null} />
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/births?${new URLSearchParams({ page: String(p) })}`} />
    </div>
  );
}
