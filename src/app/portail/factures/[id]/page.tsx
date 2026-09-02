import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { getMyObligation } from "@/lib/services/online-payments";
import { ApiError } from "@/lib/api";
import { PayForm } from "./pay-form";
import { PageHeading } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getCurrentCitizenAccount();
  if (!account) return null;

  let obligation;
  try {
    obligation = await getMyObligation(account, id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const canPay = obligation.balance > 0 && obligation.status !== "ANNULE" && obligation.status !== "REMBOURSE";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portail/factures" className="text-xs text-[var(--color-primary)] hover:underline">
          ← Mes factures
        </Link>
      </div>

      <PageHeading title={obligation.number} description={`${obligation.tarif.label} — periode ${obligation.period}`} />

      <Card>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-[var(--color-text-muted)]">Montant</dt>
            <dd className="mt-0.5">{formatFcfa(obligation.initialAmount)}</dd>
          </div>
          {obligation.penaltyAmount > 0 && (
            <div>
              <dt className="text-xs uppercase text-[var(--color-text-muted)]">Penalite</dt>
              <dd className="mt-0.5">{formatFcfa(obligation.penaltyAmount)}</dd>
            </div>
          )}
          {obligation.discountAmount > 0 && (
            <div>
              <dt className="text-xs uppercase text-[var(--color-text-muted)]">Remise</dt>
              <dd className="mt-0.5">-{formatFcfa(obligation.discountAmount)}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase text-[var(--color-text-muted)]">Deja paye</dt>
            <dd className="mt-0.5">{formatFcfa(obligation.paidAmount)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-[var(--color-text-muted)]">Solde restant</dt>
            <dd className="mt-0.5 font-semibold">{formatFcfa(obligation.balance)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-[var(--color-text-muted)]">Echeance</dt>
            <dd className="mt-0.5">{new Date(obligation.dueDate).toLocaleDateString("fr-FR")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-[var(--color-text-muted)]">Statut</dt>
            <dd className="mt-0.5">{obligation.status}</dd>
          </div>
        </dl>
      </Card>

      {canPay && (
        <Card padding="p-0">
          <CardHeader title="Payer en ligne" />
          <div className="p-5">
            <PayForm obligationId={obligation.id} defaultPhone={null} />
          </div>
        </Card>
      )}
    </div>
  );
}
