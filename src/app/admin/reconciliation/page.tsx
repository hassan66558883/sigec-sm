import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listReconciliationBatches } from "@/lib/services/reconciliation";
import { listProviderCodes } from "@/lib/services/payment-provider";
import { ReconciliationUploadForm } from "@/components/finances/reconciliation-upload-form";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";

type BatchRow = Awaited<ReturnType<typeof listReconciliationBatches>>[number];

export default async function ReconciliationPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "reconciliation", "view")) redirect("/admin");

  const batches = await listReconciliationBatches(user);

  const columns: Column<BatchRow>[] = [
    { key: "date", header: "Date", render: (b) => <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">{new Date(b.createdAt).toLocaleString("fr-FR")}</span>, sortable: true, sortValue: (b) => new Date(b.createdAt).getTime() },
    { key: "provider", header: "Prestataire", render: (b) => b.provider, sortable: true, sortValue: (b) => b.provider },
    { key: "period", header: "Periode", render: (b) => `${new Date(b.periodStart).toLocaleDateString("fr-FR")} — ${new Date(b.periodEnd).toLocaleDateString("fr-FR")}` },
    { key: "file", header: "Fichier", render: (b) => <span className="text-xs text-[var(--color-text-muted)]">{b.fileName}</span> },
    { key: "matched", header: "Reconcilies", render: (b) => <span className="text-[var(--color-success)]">{b.matchedCount}</span>, sortable: true, sortValue: (b) => b.matchedCount },
    {
      key: "discrepancies",
      header: "Ecarts",
      render: (b) => {
        const total = b.mismatchCount + b.missingInternalCount + b.unmatchedExternalCount;
        return <span className={total > 0 ? "font-medium text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"}>{total}</span>;
      },
      sortable: true,
      sortValue: (b) => b.mismatchCount + b.missingInternalCount + b.unmatchedExternalCount,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (b) => <Link href={`/admin/reconciliation/${b.id}`} className="text-xs text-[var(--color-primary)] hover:underline">Voir le detail →</Link>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Rapprochement prestataire/banque"
        description="Compare les transactions Mobile Money internes a un releve externe televerse."
        action={can(user, "reconciliation", "create") && <ReconciliationUploadForm providerCodes={listProviderCodes()} />}
      />

      {batches.length === 0 ? (
        <EmptyState title="Aucun rapprochement enregistre." />
      ) : (
        <DataTable columns={columns} rows={batches} keyField="id" emptyLabel="Aucun rapprochement." pageSize={null} />
      )}
    </div>
  );
}
