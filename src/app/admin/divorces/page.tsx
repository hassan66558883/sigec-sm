import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere, recordScopeWhere } from "@/lib/rbac";
import { listDivorces } from "@/lib/services/divorces";
import { DeclareDivorceForm } from "@/components/civil-status/declare-divorce-form";
import { ValidateButton } from "@/components/civil-status/validate-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const STATUS_LABEL: Record<string, string> = { DECLARED: "Declare", FINALIZED: "Finalise" };
const STATUS_TONE: Record<string, StatusTone> = { DECLARED: "warning", FINALIZED: "success" };

type DivorceRow = Awaited<ReturnType<typeof listDivorces>>[number];

export default async function DivorcesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "divorces", "view")) redirect("/admin");

  const [records, arrondissements, validMarriages] = await Promise.all([
    listDivorces(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    prisma.marriage.findMany({
      where: { ...recordScopeWhere(user), status: "VALID" },
      include: { husband: true, wife: true },
      take: 100,
    }),
  ]);

  const columns: Column<DivorceRow>[] = [
    { key: "recordNumber", header: "Numero", render: (r) => <span className="text-xs text-[var(--color-text-muted)]">{r.recordNumber}</span>, sortable: true, sortValue: (r) => r.recordNumber },
    {
      key: "couple",
      header: "Couple",
      render: (r) => (
        <>
          {r.marriage.husband.firstName} {r.marriage.husband.lastName} × {r.marriage.wife.firstName} {r.marriage.wife.lastName}
        </>
      ),
      sortable: true,
      sortValue: (r) => `${r.marriage.husband.lastName} ${r.marriage.husband.firstName} ${r.marriage.wife.lastName} ${r.marriage.wife.firstName}`,
    },
    { key: "date", header: "Date", render: (r) => <span className="text-[var(--color-text-muted)]">{new Date(r.divorceDate).toLocaleDateString("fr-FR")}</span>, sortable: true, sortValue: (r) => new Date(r.divorceDate).getTime() },
    { key: "status", header: "Statut", render: (r) => <StatusBadge label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />, sortable: true, sortValue: (r) => STATUS_LABEL[r.status] },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (r) => r.status === "DECLARED" && can(user, "divorces", "validate") && <ValidateButton endpoint={`/api/divorces/${r.id}`} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Divorces"
        description="Dossiers de divorce et mise a jour de la situation matrimoniale."
        action={
          can(user, "divorces", "create") && (
            <DeclareDivorceForm
              arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
              marriages={validMarriages.map((m) => ({
                id: m.id,
                label: `${m.husband.firstName} ${m.husband.lastName} × ${m.wife.firstName} ${m.wife.lastName} (${m.recordNumber})`,
              }))}
            />
          )
        }
      />

      <DataTable columns={columns} rows={records} keyField="id" emptyLabel="Aucun dossier de divorce." />
    </div>
  );
}
