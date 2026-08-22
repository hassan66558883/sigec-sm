import Link from "next/link";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { listMyObligations } from "@/lib/services/online-payments";

const STATUS_LABEL: Record<string, string> = {
  A_PAYER: "A payer",
  PARTIELLEMENT_PAYE: "Partiellement paye",
  PAYE: "Paye",
  EN_RETARD: "En retard",
  ANNULE: "Annule",
  REMBOURSE: "Rembourse",
};

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default async function MyInvoicesPage() {
  const account = await getCurrentCitizenAccount();
  if (!account) return null;

  const obligations = await listMyObligations(account);
  const solde = obligations.reduce((sum, o) => sum + o.balance, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Mes factures</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Solde total a payer : <span className="font-semibold text-[var(--color-text)]">{formatFcfa(solde)}</span>
        </p>
      </div>

      <div className="space-y-3">
        {obligations.map((o) => (
          <Link
            key={o.id}
            href={`/portail/factures/${o.id}`}
            className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm hover:bg-gray-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">{o.number} — {o.tarif.label}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  Periode {o.period} · Echeance {new Date(o.dueDate).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-[var(--color-text)]">{formatFcfa(o.balance)}</div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </div>
            </div>
          </Link>
        ))}
        {obligations.length === 0 && (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)] shadow-sm">
            Aucune facture enregistree.
          </p>
        )}
      </div>
    </div>
  );
}
