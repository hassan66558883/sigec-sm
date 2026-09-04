import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listComplaintsForStaffPage } from "@/lib/services/complaints";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";

const CATEGORY_LABEL: Record<string, string> = {
  VOIRIE: "Voirie",
  PROPRETE: "Proprete",
  ECLAIRAGE: "Eclairage",
  EAU: "Eau",
  SECURITE: "Securite",
  AUTRE: "Autre",
};
const STATUS_LABEL: Record<string, string> = {
  NEW: "Nouveau",
  RECEIVED: "Recu",
  ASSIGNED: "Affecte",
  IN_PROGRESS: "En traitement",
  PENDING: "En attente",
  RESOLVED: "Resolu",
  CLOSED: "Cloture",
};
const STATUS_TONE: Record<string, StatusTone> = {
  NEW: "warning",
  RECEIVED: "warning",
  ASSIGNED: "warning",
  IN_PROGRESS: "warning",
  PENDING: "neutral",
  RESOLVED: "success",
  CLOSED: "success",
};

type ComplaintRow = Awaited<ReturnType<typeof listComplaintsForStaffPage>>["rows"][number];

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "complaints", "view")) redirect("/admin");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { rows: complaints, total, pageSize } = await listComplaintsForStaffPage(user, page);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<ComplaintRow>[] = [
    {
      key: "caseNumber",
      header: "Numero",
      render: (c) => (
        <Link href={`/admin/complaints/${c.id}`} className="text-xs text-[var(--color-primary)] hover:underline">
          {c.caseNumber}
        </Link>
      ),
      sortable: true,
      sortValue: (c) => c.caseNumber,
    },
    {
      key: "citizen",
      header: "Citoyen",
      render: (c) => <>{c.citizenAccount.citizen.firstName} {c.citizenAccount.citizen.lastName}</>,
      sortable: true,
      sortValue: (c) => `${c.citizenAccount.citizen.lastName} ${c.citizenAccount.citizen.firstName}`,
    },
    {
      key: "category",
      header: "Categorie",
      render: (c) => <span className="text-[var(--color-text-muted)]">{CATEGORY_LABEL[c.category]}</span>,
      sortable: true,
      sortValue: (c) => c.category,
    },
    {
      key: "status",
      header: "Statut",
      render: (c) => <StatusBadge label={STATUS_LABEL[c.status]} tone={STATUS_TONE[c.status]} />,
      sortable: true,
      sortValue: (c) => c.status,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Plaintes & doleances" description="Guichet numerique — suivi des signalements citoyens." />

      <DataTable columns={columns} rows={complaints} keyField="id" emptyLabel="Aucune plainte enregistree." pageSize={null} />
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/complaints?${new URLSearchParams({ page: String(p) })}`} />
    </div>
  );
}
