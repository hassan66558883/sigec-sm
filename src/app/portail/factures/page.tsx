import Link from "next/link";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { listMyObligations } from "@/lib/services/online-payments";
import { PageHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

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
      <PageHeading
        title="Mes factures"
        description={
          <>
            Solde total a payer : <span className="font-semibold text-[var(--color-text)]">{formatFcfa(solde)}</span>
          </>
        }
      />

      <div className="space-y-3">
        {obligations.map((o) => (
          <Link key={o.id} href={`/portail/factures/${o.id}`} className="block">
            <Card hoverable>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-[var(--color-text)]">
                    {o.number} — {o.tarif.label}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Periode {o.period} · Echeance {new Date(o.dueDate).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-sm font-semibold text-[var(--color-text)]">{formatFcfa(o.balance)}</div>
                  <StatusBadge label={STATUS_LABEL[o.status] ?? o.status} tone="neutral" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
        {obligations.length === 0 && (
          <Card>
            <EmptyState title="Aucune facture enregistree." />
          </Card>
        )}
      </div>
    </div>
  );
}
