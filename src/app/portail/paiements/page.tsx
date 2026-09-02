import Link from "next/link";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { listMyPayments } from "@/lib/services/online-payments";
import { PageHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

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
      <PageHeading title="Mes paiements" description="Historique complet, y compris les paiements en attente de confirmation." />

      <div className="space-y-3">
        {payments.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">
                  {formatFcfa(p.amount)} — {p.paymentMethod}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {new Date(p.paymentDate).toLocaleString("fr-FR")}
                  {p.mobileMoney?.channel === "ONLINE" ? " · Paiement en ligne" : ""}
                </div>
              </div>
              <div className="text-end">
                <StatusBadge label={STATUS_LABEL[p.status] ?? p.status} tone="neutral" />
                {p.receipt && (
                  <div className="mt-1">
                    <Link href={`/verify-receipt/${p.receipt.qrToken}`} className="text-xs text-[var(--color-primary)] hover:underline">
                      Voir le reçu ({p.receipt.number}) →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
        {payments.length === 0 && (
          <Card>
            <EmptyState title="Aucun paiement enregistre." />
          </Card>
        )}
      </div>
    </div>
  );
}
