import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listDepartments } from "@/lib/services/departments";
import { DepartmentForm } from "@/components/departments/department-form";
import { ToggleActiveButton } from "@/components/toggle-active-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

type DepartmentRow = Awaited<ReturnType<typeof listDepartments>>[number];

export default async function DepartmentsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "departments", "view")) redirect("/admin");

  const departments = await listDepartments();

  const columns: Column<DepartmentRow>[] = [
    { key: "name", header: "Direction", render: (d) => <span className="font-medium">{d.name}</span>, sortable: true, sortValue: (d) => d.name },
    { key: "code", header: "Code", render: (d) => <span className="text-[var(--color-text-muted)]">{d.code}</span>, sortable: true, sortValue: (d) => d.code },
    { key: "users", header: "Utilisateurs", render: (d) => d._count.users, sortable: true, sortValue: (d) => d._count.users },
    {
      key: "status",
      header: "Statut",
      render: (d) => <StatusBadge label={d.isActive ? "Actif" : "Inactif"} tone={d.isActive ? "success" : "neutral"} />,
      sortable: true,
      sortValue: (d) => (d.isActive ? 1 : 0),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (d) => can(user, "departments", "edit") && <ToggleActiveButton endpoint={`/api/departments/${d.id}`} isActive={d.isActive} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Services centraux" description="Directions de la Mairie Centrale — organisationnel uniquement, n'affecte pas le perimetre territorial des arrondissements." />

      {can(user, "departments", "create") && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Ajouter une direction</h2>
          <DepartmentForm />
        </div>
      )}

      <DataTable columns={columns} rows={departments} keyField="id" emptyLabel="Aucune direction centrale enregistree." />
    </div>
  );
}
