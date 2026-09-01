import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listApplicationsForStaff } from "@/lib/services/applications";
import { ApplicationActions } from "@/components/civil-status/application-actions";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const TYPE_LABEL: Record<string, string> = {
  BIRTH_CERTIFICATE_COPY: "Copie d'acte de naissance",
  MARRIAGE_CERTIFICATE_COPY: "Copie d'acte de mariage",
  DEATH_CERTIFICATE_COPY: "Copie d'acte de deces",
};
const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Soumise",
  IN_REVIEW: "En traitement",
  APPROVED: "Approuvee",
  REJECTED: "Rejetee",
  COMPLETED: "Terminee",
};
const STATUS_TONE: Record<string, StatusTone> = {
  SUBMITTED: "warning",
  IN_REVIEW: "warning",
  APPROVED: "success",
  COMPLETED: "success",
  REJECTED: "danger",
};

type ApplicationRow = Awaited<ReturnType<typeof listApplicationsForStaff>>[number];

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "applications", "view")) redirect("/admin");

  const applications = await listApplicationsForStaff(user);

  const columns: Column<ApplicationRow>[] = [
    { key: "applicationNumber", header: "Numero", render: (a) => <span className="text-xs text-[var(--color-text-muted)]">{a.applicationNumber}</span> },
    { key: "citizen", header: "Citoyen", render: (a) => <>{a.citizenAccount.citizen.firstName} {a.citizenAccount.citizen.lastName}</> },
    { key: "type", header: "Type", render: (a) => TYPE_LABEL[a.type] },
    { key: "status", header: "Statut", render: (a) => <StatusBadge label={STATUS_LABEL[a.status]} tone={STATUS_TONE[a.status]} /> },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (a) =>
        (a.status === "SUBMITTED" || a.status === "IN_REVIEW") && (
          <ApplicationActions id={a.id} canApprove={can(user, "applications", "approve")} canReject={can(user, "applications", "reject")} />
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Demandes citoyennes" description="File de traitement des demandes soumises depuis le portail citoyen." />

      <DataTable columns={columns} rows={applications} keyField="id" emptyLabel="Aucune demande a traiter." />
    </div>
  );
}
