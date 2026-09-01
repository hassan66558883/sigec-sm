import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listMobileMoneyTransactions } from "@/lib/services/mobile-money";
import { ConfirmTransactionButtons } from "@/components/mobile-money/confirm-transaction-buttons";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { IconActivity } from "@/components/icons";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

const STATUS_TONE: Record<string, StatusTone> = {
  INITIATED: "warning",
  PENDING: "warning",
  SUCCESS: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
};

type TransactionRow = Awaited<ReturnType<typeof listMobileMoneyTransactions>>[number];

export default async function MobileMoneyPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "mobile_money", "view")) redirect("/admin");

  const transactions = await listMobileMoneyTransactions(user);

  const success = transactions.filter((t) => t.status === "SUCCESS").length;
  const pending = transactions.filter((t) => t.status === "INITIATED" || t.status === "PENDING").length;
  const failed = transactions.filter((t) => t.status === "FAILED" || t.status === "CANCELLED").length;
  const total = transactions.length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

  const columns: Column<TransactionRow>[] = [
    { key: "ref", header: "Reference", render: (t) => <span className="text-xs text-[var(--color-text-muted)]">{t.externalReference ?? "—"}</span> },
    { key: "payer", header: "Payeur", render: (t) => <>{t.payment.payer.firstName} {t.payment.payer.lastName}</> },
    { key: "phone", header: "Telephone", render: (t) => <span className="text-[var(--color-text-muted)]">{t.phoneNumber ?? "—"}</span> },
    { key: "amount", header: "Montant", render: (t) => <span className="font-medium">{formatFcfa(t.amount)}</span> },
    { key: "initiated", header: "Initiee", render: (t) => <span className="text-xs text-[var(--color-text-muted)]">{new Date(t.initiatedAt).toLocaleString("fr-FR")}</span> },
    { key: "status", header: "Statut", render: (t) => <StatusBadge label={t.status} tone={STATUS_TONE[t.status] ?? "neutral"} /> },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (t) => (t.status === "INITIATED" || t.status === "PENDING") && can(user, "mobile_money", "confirm") && <ConfirmTransactionButtons id={t.id} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Mobile Money"
        description="Aucun prestataire n'est encore contractualise : chaque transaction reste en attente jusqu'a confirmation explicite — aucun succes n'est jamais simule automatiquement."
      />

      {total > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Paiements reussis" value={`${pct(success)}%`} hint={`${success} transaction(s)`} icon={<IconActivity className="h-5 w-5" />} tone="success" />
          <StatCard label="En attente" value={`${pct(pending)}%`} hint={`${pending} transaction(s)`} tone="warning" />
          <StatCard label="Echoues" value={`${pct(failed)}%`} hint={`${failed} transaction(s)`} tone="danger" />
        </div>
      )}

      <DataTable columns={columns} rows={transactions} keyField="id" emptyLabel="Aucune transaction Mobile Money." />
    </div>
  );
}
