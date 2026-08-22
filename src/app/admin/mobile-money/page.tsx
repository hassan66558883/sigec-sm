import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listMobileMoneyTransactions } from "@/lib/services/mobile-money";
import { ConfirmTransactionButtons } from "@/components/mobile-money/confirm-transaction-buttons";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

const STATUS_CLASS: Record<string, string> = {
  INITIATED: "bg-amber-100 text-[var(--color-warning)]",
  PENDING: "bg-amber-100 text-[var(--color-warning)]",
  SUCCESS: "bg-green-100 text-[var(--color-success)]",
  FAILED: "bg-red-100 text-[var(--color-danger)]",
  CANCELLED: "bg-gray-100 text-[var(--color-text-muted)]",
  REFUNDED: "bg-gray-100 text-[var(--color-text-muted)]",
};

export default async function MobileMoneyPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "mobile_money", "view")) redirect("/admin");

  const transactions = await listMobileMoneyTransactions(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Mobile Money</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Aucun prestataire n&apos;est encore contractualise : chaque transaction reste en attente jusqu&apos;a confirmation
          explicite — aucun succes n&apos;est jamais simule automatiquement.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Reference</th>
              <th className="px-4 py-2.5">Payeur</th>
              <th className="px-4 py-2.5">Telephone</th>
              <th className="px-4 py-2.5">Montant</th>
              <th className="px-4 py-2.5">Initiee</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{t.externalReference ?? "—"}</td>
                <td className="px-4 py-2.5">{t.payment.payer.firstName} {t.payment.payer.lastName}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{t.phoneNumber ?? "—"}</td>
                <td className="px-4 py-2.5 font-medium">{formatFcfa(t.amount)}</td>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{new Date(t.initiatedAt).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[t.status] ?? ""}`}>{t.status}</span>
                </td>
                <td className="px-4 py-2.5">
                  {(t.status === "INITIATED" || t.status === "PENDING") && can(user, "mobile_money", "confirm") && (
                    <ConfirmTransactionButtons id={t.id} />
                  )}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--color-text-muted)]">Aucune transaction Mobile Money.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
