import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listReceiptsPage } from "@/lib/services/receipts";
import { ReasonActionButton } from "@/components/finances/reason-action-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

type ReceiptRow = Awaited<ReturnType<typeof listReceiptsPage>>["rows"][number];

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "receipts", "view")) redirect("/admin");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { rows: receipts, total, pageSize } = await listReceiptsPage(user, page);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<ReceiptRow>[] = [
    { key: "number", header: "Numero", render: (r) => <span className="text-xs text-[var(--color-text-muted)]">{r.number}</span>, sortable: true, sortValue: (r) => r.number },
    { key: "payer", header: "Payeur", render: (r) => <>{r.payment.payer.firstName} {r.payment.payer.lastName}</>, sortable: true, sortValue: (r) => `${r.payment.payer.lastName} ${r.payment.payer.firstName}` },
    { key: "amount", header: "Montant", render: (r) => <span className="font-medium">{formatFcfa(r.payment.amount)}</span>, sortable: true, sortValue: (r) => r.payment.amount },
    { key: "date", header: "Date", render: (r) => <span className="text-[var(--color-text-muted)]">{new Date(r.payment.paymentDate).toLocaleDateString("fr-FR")}</span>, sortable: true, sortValue: (r) => new Date(r.payment.paymentDate).getTime() },
    { key: "status", header: "Statut", render: (r) => <StatusBadge label={r.status} tone={r.status === "VALIDE" ? "success" : "danger"} />, sortable: true, sortValue: (r) => r.status },
    {
      key: "qr",
      header: "QR",
      render: (r) => (
        <>
          <a href={`/api/receipts/${r.id}/qr`} target="_blank" className="text-xs text-[var(--color-primary)] hover:underline">
            Voir le QR
          </a>
          <span className="mx-1 text-[var(--color-text-muted)]">·</span>
          <a href={`/verify-receipt/${r.qrToken}`} target="_blank" className="text-xs text-[var(--color-primary)] hover:underline">
            Verifier
          </a>
        </>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (r) => can(user, "receipts", "cancel") && r.status === "VALIDE" && <ReasonActionButton endpoint={`/api/receipts/${r.id}`} action="void" label="Annuler" />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Reçus"
        description="Un reçu est genere automatiquement pour chaque paiement enregistre — jamais de numero reutilise."
        action={
          can(user, "receipts", "export") && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- telechargement de fichier (route API), pas une page a naviguer
            <a href="/api/receipts/export" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]">
              Exporter (CSV)
            </a>
          )
        }
      />

      <DataTable columns={columns} rows={receipts} keyField="id" emptyLabel="Aucun reçu genere." pageSize={null} />
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/receipts?${new URLSearchParams({ page: String(p) })}`} />
    </div>
  );
}
