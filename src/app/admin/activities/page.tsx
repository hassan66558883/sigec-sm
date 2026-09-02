import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listActivities } from "@/lib/services/activities";
import { ActivityForm } from "@/components/finances/activity-form";
import { ToggleActiveButton } from "@/components/toggle-active-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

type ActivityRow = Awaited<ReturnType<typeof listActivities>>[number];

export default async function ActivitiesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "tariffs", "view")) redirect("/admin");

  const activities = await listActivities();

  const columns: Column<ActivityRow>[] = [
    { key: "code", header: "Code", render: (a) => <span className="text-xs text-[var(--color-text-muted)]">{a.code}</span>, sortable: true, sortValue: (a) => a.code },
    { key: "name", header: "Nom", render: (a) => <span className="font-medium">{a.name}</span>, sortable: true, sortValue: (a) => a.name },
    { key: "description", header: "Description", render: (a) => <span className="text-[var(--color-text-muted)]">{a.description ?? "—"}</span>, sortable: true, sortValue: (a) => a.description ?? "" },
    { key: "status", header: "Statut", render: (a) => <StatusBadge label={a.isActive ? "Actif" : "Inactif"} tone={a.isActive ? "success" : "neutral"} />, sortable: true, sortValue: (a) => (a.isActive ? "Actif" : "Inactif") },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (a) => can(user, "tariffs", "edit") && <ToggleActiveButton endpoint={`/api/activities/${a.id}`} isActive={a.isActive} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Activites economiques"
        description="Referentiel des activites (module recensement) utilise pour classer boutiques et tarifs."
        action={can(user, "tariffs", "create") && <ActivityForm />}
      />

      <DataTable columns={columns} rows={activities} keyField="id" emptyLabel="Aucune activite enregistree." />
    </div>
  );
}
