import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listAssociations } from "@/lib/services/associations";
import { listCitizens } from "@/lib/services/citizens";
import { AssociationForm } from "@/components/municipal/association-form";
import { StatusSelect } from "@/components/municipal/status-select";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";

const STATUS_LABEL: Record<string, string> = { REGISTERED: "Enregistree", SUSPENDED: "Suspendue", DISSOLVED: "Dissoute" };

type AssociationRow = Awaited<ReturnType<typeof listAssociations>>[number];

export default async function AssociationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "associations", "view")) redirect("/admin");

  const [associations, arrondissements, citizens] = await Promise.all([
    listAssociations(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
  ]);

  const columns: Column<AssociationRow>[] = [
    { key: "registrationNumber", header: "Numero", render: (a) => <span className="text-xs text-[var(--color-text-muted)]">{a.registrationNumber}</span> },
    { key: "name", header: "Nom", render: (a) => <span className="font-medium">{a.name}</span> },
    { key: "type", header: "Type", render: (a) => <span className="text-[var(--color-text-muted)]">{a.type || "—"}</span> },
    { key: "leader", header: "Responsable", render: (a) => (a.leader ? `${a.leader.firstName} ${a.leader.lastName}` : "—") },
    {
      key: "status",
      header: "Statut",
      render: (a) =>
        can(user, "associations", "edit") ? (
          <StatusSelect endpoint={`/api/associations/${a.id}`} value={a.status} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        ) : (
          STATUS_LABEL[a.status]
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Associations & ONG"
        description="Registre des associations et ONG locales."
        action={
          can(user, "associations", "create") && (
            <AssociationForm
              arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
              citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` }))}
            />
          )
        }
      />

      <DataTable columns={columns} rows={associations} keyField="id" emptyLabel="Aucune association enregistree." />
    </div>
  );
}
