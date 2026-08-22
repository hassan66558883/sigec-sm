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
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: "var(--color-primary)" }}
          >
            SM
          </div>
          <h1 className="text-base font-semibold text-[var(--color-text)]">Verification du reçu</h1>
          <p className="text-xs text-[var(--color-text-muted)]">SIGEC-SM — Ville de N&apos;Djamena</p>
        </div>

        {!result.found ? (
          <div className="rounded-md border border-[var(--color-danger)]/30 bg-red-50 p-4 text-center">
            <div className="text-lg font-semibold text-[var(--color-danger)]">REÇU INTROUVABLE</div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Aucun reçu ne correspond a ce code de verification.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={`rounded-md p-4 text-center ${
                result.valid ? "border border-[var(--color-success)]/30 bg-green-50" : "border border-[var(--color-danger)]/30 bg-red-50"
              }`}
            >
              <div className={`text-lg font-semibold ${result.valid ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                {result.valid ? "REÇU AUTHENTIQUE" : "REÇU ANNULE"}
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                <dt className="text-[var(--color-text-muted)]">Numero</dt>
                <dd className="font-medium">{result.number}</dd>
              </div>
              <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                <dt className="text-[var(--color-text-muted)]">Montant</dt>
                <dd className="font-medium">{formatFcfa(result.amount)}</dd>
              </div>
              <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                <dt className="text-[var(--color-text-muted)]">Date</dt>
                <dd className="font-medium">{new Date(result.paymentDate).toLocaleDateString("fr-FR")}</dd>
              </div>
              <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                <dt className="text-[var(--color-text-muted)]">Mode de paiement</dt>
                <dd className="font-medium">{result.paymentMethod}</dd>
              </div>
              <div className="flex justify-between pb-2">
                <dt className="text-[var(--color-text-muted)]">Autorite</dt>
                <dd className="font-medium">{result.authority}</dd>
              </div>
            </dl>

            <p className="text-center text-xs text-[var(--color-text-muted)]">
              {result.valid ? "Reçu authentique." : "Ce reçu a ete annule et n'est plus valable."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
