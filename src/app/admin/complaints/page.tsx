import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listComplaintsForStaff } from "@/lib/services/complaints";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

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

type ComplaintRow = Awaited<ReturnType<typeof listComplaintsForStaff>>[number];

export default async function ComplaintsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "complaints", "view")) redirect("/admin");

  const complaints = await listComplaintsForStaff(user);

  const columns: Column<ComplaintRow>[] = [
    {
      key: "caseNumber",
      header: "Numero",
      render: (c) => (
        <Link href={`/admin/complaints/${c.id}`} className="text-xs text-[var(--color-primary)] hover:underline">
          {c.caseNumber}
        </Link>
      ),
    },
    { key: "citizen", header: "Citoyen", render: (c) => <>{c.citizenAccount.citizen.firstName} {c.citizenAccount.citizen.lastName}</> },
    { key: "category", header: "Categorie", render: (c) => <span className="text-[var(--color-text-muted)]">{CATEGORY_LABEL[c.category]}</span> },
    { key: "status", header: "Statut", render: (c) => <StatusBadge label={STATUS_LABEL[c.status]} tone={STATUS_TONE[c.status]} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Plaintes & doleances" description="Guichet numerique — suivi des signalements citoyens." />

      <DataTable columns={columns} rows={complaints} keyField="id" emptyLabel="Aucune plainte enregistree." />
    </div>
  );
}
