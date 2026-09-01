import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listRecognitions } from "@/lib/services/recognitions";
import { listCitizens } from "@/lib/services/citizens";
import { DeclareRecognitionForm } from "@/components/civil-status/declare-recognition-form";
import { ValidateButton } from "@/components/civil-status/validate-button";
import { IssueCertificateButton } from "@/components/civil-status/issue-certificate-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const STATUS_LABEL: Record<string, string> = { DECLARED: "Declaree", VALIDATED: "Validee" };
const STATUS_TONE: Record<string, StatusTone> = { DECLARED: "warning", VALIDATED: "success" };

type RecognitionRow = Awaited<ReturnType<typeof listRecognitions>>[number];

export default async function RecognitionsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "recognitions", "view")) redirect("/admin");

  const [records, arrondissements, citizens] = await Promise.all([
    listRecognitions(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
  ]);

  const columns: Column<RecognitionRow>[] = [
    { key: "recordNumber", header: "Numero", render: (r) => <span className="text-xs text-[var(--color-text-muted)]">{r.recordNumber}</span> },
    { key: "child", header: "Enfant", render: (r) => <span className="font-medium">{r.child.firstName} {r.child.lastName}</span> },
    {
      key: "parent",
      header: "Parent",
      render: (r) => (
        <>
          {r.parent.firstName} {r.parent.lastName} ({r.parentRole === "FATHER" ? "Pere" : "Mere"})
        </>
      ),
    },
    { key: "status", header: "Statut", render: (r) => <StatusBadge label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} /> },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (r) => (
        <div className="flex justify-end gap-2">
          {r.status === "DECLARED" && can(user, "recognitions", "validate") && <ValidateButton endpoint={`/api/recognitions/${r.id}`} />}
          {r.status === "VALIDATED" && can(user, "certificates", "create") && (
            <IssueCertificateButton sourceType="recognition" sourceId={r.id} label="Certificat" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Reconnaissances d'enfant"
        description="Declaration de reconnaissance par le pere ou la mere."
        action={
          can(user, "recognitions", "create") && (
            <DeclareRecognitionForm
              arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
              citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
            />
          )
        }
      />

      <DataTable columns={columns} rows={records} keyField="id" emptyLabel="Aucune reconnaissance enregistree." />
    </div>
  );
}
