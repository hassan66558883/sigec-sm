import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can, recordScopeWhere } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { listMobileMoneyTransactionsPage } from "@/lib/services/mobile-money";
import { ConfirmTransactionButtons } from "@/components/mobile-money/confirm-transaction-buttons";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
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

type TransactionRow = Awaited<ReturnType<typeof listMobileMoneyTransactionsPage>>["rows"][number];

export default async function MobileMoneyPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "mobile_money", "view")) redirect("/admin");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ rows: transactions, total: pageTotal, pageSize }, statusCounts] = await Promise.all([
    listMobileMoneyTransactionsPage(user, undefined, page),
    // Statistiques calculees sur l'ensemble du perimetre (pas seulement la
    // page courante) via un groupBy dedie cote base — sinon, une fois la
    // pagination reelle en place, ces pourcentages ne refleteraient plus
    // que les ~25 lignes de la page affichee (meme choix que pour les
    // stats de /admin/caisses et totalCount/failureCount sur /admin/audit).
    prisma.mobileMoneyTransaction.groupBy({ by: ["status"], where: { payment: recordScopeWhere(user) }, _count: true }),
  ]);
  const totalPages = Math.max(1, Math.ceil(pageTotal / pageSize));

  const countByStatus = new Map(statusCounts.map((s) => [s.status, s._count]));
  const success = countByStatus.get("SUCCESS") ?? 0;
  const pending = (countByStatus.get("INITIATED") ?? 0) + (countByStatus.get("PENDING") ?? 0);
  const failed = (countByStatus.get("FAILED") ?? 0) + (countByStatus.get("CANCELLED") ?? 0);
  const total = statusCounts.reduce((sum, s) => sum + s._count, 0);
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

  const columns: Column<TransactionRow>[] = [
    { key: "ref", header: "Reference", render: (t) => <span className="text-xs text-[var(--color-text-muted)]">{t.externalReference ?? "—"}</span>, sortable: true, sortValue: (t) => t.externalReference ?? "" },
    { key: "payer", header: "Payeur", render: (t) => <>{t.payment.payer.firstName} {t.payment.payer.lastName}</>, sortable: true, sortValue: (t) => `${t.payment.payer.lastName} ${t.payment.payer.firstName}` },
    { key: "phone", header: "Telephone", render: (t) => <span className="text-[var(--color-text-muted)]">{t.phoneNumber ?? "—"}</span>, sortable: true, sortValue: (t) => t.phoneNumber ?? "" },
    { key: "amount", header: "Montant", render: (t) => <span className="font-medium">{formatFcfa(t.amount)}</span>, sortable: true, sortValue: (t) => t.amount },
    { key: "initiated", header: "Initiee", render: (t) => <span className="text-xs text-[var(--color-text-muted)]">{new Date(t.initiatedAt).toLocaleString("fr-FR")}</span>, sortable: true, sortValue: (t) => new Date(t.initiatedAt).getTime() },
    { key: "status", header: "Statut", render: (t) => <StatusBadge label={t.status} tone={STATUS_TONE[t.status] ?? "neutral"} />, sortable: true, sortValue: (t) => t.status },
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

      <DataTable columns={columns} rows={transactions} keyField="id" emptyLabel="Aucune transaction Mobile Money." pageSize={null} />
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/mobile-money?${new URLSearchParams({ page: String(p) })}`} />
    </div>
  );
}
