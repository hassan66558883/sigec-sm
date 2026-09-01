import { verifyReceiptPublic } from "@/lib/services/receipts";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

// Verification publique d'un reçu (section 19) : aucune authentification,
// aucune donnee personnelle exposee (jamais le nom du contribuable) — meme
// principe que /verify/[token] pour les certificats.
export default async function VerifyReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await verifyReceiptPublic(token);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(150deg, var(--color-primary-dark), var(--color-primary) 55%, #156ab0)" }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
        <div className="px-8 pb-6 pt-8 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md"
            style={{ background: "var(--gradient-primary)" }}
          >
            SM
          </div>
          <h1 className="text-base font-semibold text-[var(--color-text)]">Verification du reçu</h1>
          <p className="text-xs text-[var(--color-text-muted)]">SIGEC-SM — Ville de N&apos;Djamena</p>
        </div>

        {!result.found ? (
          <div className="mx-8 mb-8 rounded-xl border border-rose-200 bg-rose-50 p-5 text-center">
            <div className="text-lg font-semibold text-[var(--color-danger)]">REÇU INTROUVABLE</div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Aucun reçu ne correspond a ce code de verification.</p>
          </div>
        ) : (
          <div className="px-8 pb-8">
            <div className={`rounded-xl p-5 text-center ${result.valid ? "border border-emerald-200 bg-emerald-50" : "border border-rose-200 bg-rose-50"}`}>
              <div className={`text-lg font-semibold ${result.valid ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                {result.valid ? "✓ REÇU AUTHENTIQUE" : "REÇU ANNULE"}
              </div>
            </div>

            <dl className="mt-5 space-y-0 text-sm">
              <div className="flex justify-between border-b border-[var(--color-border-subtle)] py-2.5">
                <dt className="text-[var(--color-text-muted)]">Numero</dt>
                <dd className="font-medium text-[var(--color-text)]">{result.number}</dd>
              </div>
              <div className="flex justify-between border-b border-[var(--color-border-subtle)] py-2.5">
                <dt className="text-[var(--color-text-muted)]">Montant</dt>
                <dd className="font-medium text-[var(--color-text)]">{formatFcfa(result.amount)}</dd>
              </div>
              <div className="flex justify-between border-b border-[var(--color-border-subtle)] py-2.5">
                <dt className="text-[var(--color-text-muted)]">Date</dt>
                <dd className="font-medium text-[var(--color-text)]">{new Date(result.paymentDate).toLocaleDateString("fr-FR")}</dd>
              </div>
              <div className="flex justify-between border-b border-[var(--color-border-subtle)] py-2.5">
                <dt className="text-[var(--color-text-muted)]">Mode de paiement</dt>
                <dd className="font-medium text-[var(--color-text)]">{result.paymentMethod}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-[var(--color-text-muted)]">Autorite</dt>
                <dd className="font-medium text-[var(--color-text)]">{result.authority}</dd>
              </div>
            </dl>

            <p className="mt-4 text-center text-xs text-[var(--color-text-muted)]">
              {result.valid ? "Reçu authentique." : "Ce reçu a ete annule et n'est plus valable."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
