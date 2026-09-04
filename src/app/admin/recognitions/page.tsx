import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listRecognitionsPage } from "@/lib/services/recognitions";
import { listCitizens } from "@/lib/services/citizens";
import { DeclareRecognitionForm } from "@/components/civil-status/declare-recognition-form";
import { ValidateButton } from "@/components/civil-status/validate-button";
import { IssueCertificateButton } from "@/components/civil-status/issue-certificate-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const STATUS_LABEL: Record<string, string> = { DECLARED: "Declaree", VALIDATED: "Validee" };
const STATUS_TONE: Record<string, StatusTone> = { DECLARED: "warning", VALIDATED: "success" };

type RecognitionRow = Awaited<ReturnType<typeof listRecognitionsPage>>["rows"][number];

export default async function RecognitionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "recognitions", "view")) redirect("/admin");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ rows: records, total, pageSize }, arrondissements, citizens] = await Promise.all([
    listRecognitionsPage(user, page),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<RecognitionRow>[] = [
    { key: "recordNumber", header: "Numero", render: (r) => <span className="text-xs text-[var(--color-text-muted)]">{r.recordNumber}</span>, sortable: true, sortValue: (r) => r.recordNumber },
    { key: "child", header: "Enfant", render: (r) => <span className="font-medium">{r.child.firstName} {r.child.lastName}</span>, sortable: true, sortValue: (r) => `${r.child.lastName} ${r.child.firstName}` },
    {
      key: "parent",
      header: "Parent",
      render: (r) => (
        <>
          {r.parent.firstName} {r.parent.lastName} ({r.parentRole === "FATHER" ? "Pere" : "Mere"})
        </>
      ),
      sortable: true,
      sortValue: (r) => `${r.parent.lastName} ${r.parent.firstName}`,
    },
    { key: "status", header: "Statut", render: (r) => <StatusBadge label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />, sortable: true, sortValue: (r) => STATUS_LABEL[r.status] },
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

      <DataTable columns={columns} rows={records} keyField="id" emptyLabel="Aucune reconnaissance enregistree." pageSize={null} />
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/recognitions?${new URLSearchParams({ page: String(p) })}`} />
    </div>
  );
}
