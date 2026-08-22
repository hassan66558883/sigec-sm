import { notFound } from "next/navigation";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { getMyObligation } from "@/lib/services/online-payments";
import { ApiError } from "@/lib/api";
import { PayForm } from "./pay-form";

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
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{obligation.number}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{obligation.tarif.label} — periode {obligation.period}</p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-[var(--color-text-muted)]">Montant</dt><dd>{formatFcfa(obligation.initialAmount)}</dd></div>
          {obligation.penaltyAmount > 0 && (
            <div><dt className="text-xs text-[var(--color-text-muted)]">Penalite</dt><dd>{formatFcfa(obligation.penaltyAmount)}</dd></div>
          )}
          {obligation.discountAmount > 0 && (
            <div><dt className="text-xs text-[var(--color-text-muted)]">Remise</dt><dd>-{formatFcfa(obligation.discountAmount)}</dd></div>
          )}
          <div><dt className="text-xs text-[var(--color-text-muted)]">Deja paye</dt><dd>{formatFcfa(obligation.paidAmount)}</dd></div>
          <div><dt className="text-xs text-[var(--color-text-muted)]">Solde restant</dt><dd className="font-semibold">{formatFcfa(obligation.balance)}</dd></div>
          <div><dt className="text-xs text-[var(--color-text-muted)]">Echeance</dt><dd>{new Date(obligation.dueDate).toLocaleDateString("fr-FR")}</dd></div>
          <div><dt className="text-xs text-[var(--color-text-muted)]">Statut</dt><dd>{obligation.status}</dd></div>
        </dl>
      </div>

      {canPay && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Payer en ligne</h2>
          <PayForm obligationId={obligation.id} defaultPhone={null} />
        </div>
      )}
    </div>
  );
}
