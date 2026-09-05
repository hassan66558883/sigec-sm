import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listMappings } from "@/lib/services/integration-mapping";
import { listImportJobs } from "@/lib/services/integration-import";
import { ImportWizard } from "@/components/integration/import-wizard";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const STATUS_TONE: Record<string, StatusTone> = { PREVIEWED: "neutral", IMPORTED: "success", FAILED: "danger" };

type JobRow = Awaited<ReturnType<typeof listImportJobs>>[number];

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "import_export")) redirect("/admin/integration");

  const [mappings, jobs] = await Promise.all([listMappings(user), listImportJobs(user)]);

  const columns: Column<JobRow>[] = [
    { key: "date", header: "Date", render: (j) => <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">{new Date(j.createdAt).toLocaleString("fr-FR")}</span> },
    { key: "file", header: "File", render: (j) => j.fileName },
    { key: "mapping", header: "Mapping", render: (j) => j.mapping?.name ?? "—" },
    { key: "total", header: "Total", render: (j) => j.totalRows },
    { key: "valid", header: "Valid", render: (j) => j.validRows },
    { key: "invalid", header: "Invalid", render: (j) => j.invalidRows },
    { key: "imported", header: "Imported", render: (j) => j.importedRows },
    { key: "status", header: "Status", render: (j) => <StatusBadge label={j.status} tone={STATUS_TONE[j.status] ?? "neutral"} /> },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <PageHeading title="Import / Export" description="Assistant d'import CSV — analyse, mapping, validation et apercu avant toute ecriture reelle." />
        <ImportWizard mappings={mappings.map((m) => ({ id: m.id, label: m.name }))} />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Recent Imports</h2>
        <DataTable columns={columns} rows={jobs} keyField="id" emptyLabel="Aucun import." pageSize={null} />
      </div>
    </div>
  );
}
