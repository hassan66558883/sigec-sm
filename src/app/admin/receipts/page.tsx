import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listReceipts } from "@/lib/services/receipts";
import { ReasonActionButton } from "@/components/finances/reason-action-button";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default async function ReceiptsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "receipts", "view")) redirect("/admin");

  const receipts = await listReceipts(user);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Reçus</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Un reçu est genere automatiquement pour chaque paiement enregistre — jamais de numero reutilise.
          </p>
        </div>
        {can(user, "receipts", "export") && (
          <a href="/api/receipts/export" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-gray-50">
            Exporter (CSV)
          </a>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Payeur</th>
              <th className="px-4 py-2.5">Montant</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5">QR</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {receipts.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{r.number}</td>
                <td className="px-4 py-2.5">{r.payment.payer.firstName} {r.payment.payer.lastName}</td>
                <td className="px-4 py-2.5 font-medium">{formatFcfa(r.payment.amount)}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{new Date(r.payment.paymentDate).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "VALIDE" ? "bg-green-100 text-[var(--color-success)]" : "bg-red-100 text-[var(--color-danger)]"}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <a href={`/api/receipts/${r.id}/qr`} target="_blank" className="text-xs text-[var(--color-primary)] hover:underline">Voir le QR</a>
                  <span className="mx-1 text-[var(--color-text-muted)]">·</span>
                  <a href={`/verify-receipt/${r.qrToken}`} target="_blank" className="text-xs text-[var(--color-primary)] hover:underline">Verifier</a>
                </td>
                <td className="px-4 py-2.5">
                  {can(user, "receipts", "cancel") && r.status === "VALIDE" && (
                    <ReasonActionButton endpoint={`/api/receipts/${r.id}`} action="void" label="Annuler" />
                  )}
                </td>
              </tr>
            ))}
            {receipts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--color-text-muted)]">Aucun reçu genere.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
