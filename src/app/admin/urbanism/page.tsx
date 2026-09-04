import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere, recordScopeWhere } from "@/lib/rbac";
import { listUrbanCasesPage } from "@/lib/services/urbanism";
import { listCitizens } from "@/lib/services/citizens";
import { SubmitCaseForm } from "@/components/urbanism/submit-case-form";
import { CaseWorkflowActions } from "@/components/urbanism/case-workflow-actions";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";

const TYPE_LABEL: Record<string, string> = { BUILDING_PERMIT: "Permis de construire", DEMOLITION_PERMIT: "Autorisation de demolition" };
const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Soumise",
  UNDER_REVIEW: "En instruction",
  INSPECTED: "Controlee",
  APPROVED: "Approuvee",
  REJECTED: "Rejetee",
};
const STATUS_TONE: Record<string, StatusTone> = {
  SUBMITTED: "warning",
  UNDER_REVIEW: "warning",
  INSPECTED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

type CaseRow = Awaited<ReturnType<typeof listUrbanCasesPage>>["rows"][number];

export default async function UrbanismPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "urbanism", "view")) redirect("/admin");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ rows: cases, total, pageSize }, parcels, citizens, arrondissements] = await Promise.all([
    listUrbanCasesPage(user, page),
    prisma.landParcel.findMany({ where: recordScopeWhere(user), take: 100 }),
    listCitizens(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<CaseRow>[] = [
    {
      key: "caseNumber",
      header: "Numero",
      render: (c) => (
        <Link href={`/admin/urbanism/${c.id}`} className="text-xs text-[var(--color-primary)] hover:underline">
          {c.caseNumber}
        </Link>
      ),
      sortable: true,
      sortValue: (c) => c.caseNumber,
    },
    { key: "type", header: "Type", render: (c) => TYPE_LABEL[c.type], sortable: true, sortValue: (c) => c.type },
    {
      key: "applicant",
      header: "Demandeur",
      render: (c) => <>{c.applicant.firstName} {c.applicant.lastName}</>,
      sortable: true,
      sortValue: (c) => `${c.applicant.lastName} ${c.applicant.firstName}`,
    },
    {
      key: "status",
      header: "Statut",
      render: (c) => <StatusBadge label={STATUS_LABEL[c.status]} tone={STATUS_TONE[c.status]} />,
      sortable: true,
      sortValue: (c) => c.status,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (c) => (
        <CaseWorkflowActions id={c.id} status={c.status} canReview={can(user, "urbanism", "review")} canInspect={can(user, "urbanism", "inspect")} canDecide={can(user, "urbanism", "decide")} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Urbanisme"
        description="Permis de construire et autorisations de demolition."
        action={
          can(user, "urbanism", "create") && (
            <SubmitCaseForm
              parcels={parcels.map((p) => ({ id: p.id, label: p.parcelNumber }))}
              citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
              arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
            />
          )
        }
      />

      <DataTable columns={columns} rows={cases} keyField="id" emptyLabel="Aucun dossier d'urbanisme." pageSize={null} />
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/urbanism?${new URLSearchParams({ page: String(p) })}`} />
    </div>
  );
}
