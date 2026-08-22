import Link from "next/link";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { listMyPayments } from "@/lib/services/online-payments";

const STATUS_LABEL: Record<string, string> = {
  PAID: "Paye",
  PENDING: "En attente",
  OVERDUE: "Echu",
  ANNULE: "Annule",
  ECHEC: "Echec",
  REMBOURSE: "Rembourse",
};

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default async function MyPaymentsPage() {
  const account = await getCurrentCitizenAccount();
  if (!account) return null;

  const payments = await listMyPayments(account);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Mes paiements</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Historique complet, y compris les paiements en attente de confirmation.</p>
      </div>

      <div className="space-y-3">
        {payments.map((p) => (
          <div key={p.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">{formatFcfa(p.amount)} — {p.paymentMethod}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {new Date(p.paymentDate).toLocaleString("fr-FR")}
                  {p.mobileMoney?.channel === "ONLINE" ? " · Paiement en ligne" : ""}
                </div>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
                {p.receipt && (
                  <div className="mt-1">
                    <Link href={`/verify-receipt/${p.receipt.qrToken}`} className="text-xs text-[var(--color-primary)] hover:underline">
                      Voir le reçu ({p.receipt.number}) →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {payments.length === 0 && (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)] shadow-sm">
            Aucun paiement enregistre.
          </p>
        )}
      </div>
    </div>
  );
}
