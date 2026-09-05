import { headers } from "next/headers";
import { verifyReceiptPublic } from "@/lib/services/receipts";
import { isRateLimited } from "@/lib/rate-limit";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

// Meme budget que /api/verify-receipt/[token] (route API equivalente) —
// voir audit securite/performance 2026-09-02.
const VERIFY_WINDOW_MS = 5 * 60 * 1000;
const VERIFY_MAX_ATTEMPTS = 20;

// Verification publique d'un reçu (section 19) : aucune authentification,
// aucune donnee personnelle exposee (jamais le nom du contribuable) — meme
// principe que /verify/[token] pour les certificats.
export default async function VerifyReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const hdrs = await headers();
  const ipAddress = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? "unknown";

  if (isRateLimited(`verify-receipt:${ipAddress}`, VERIFY_WINDOW_MS, VERIFY_MAX_ATTEMPTS)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10" style={{ background: "linear-gradient(150deg, var(--color-primary-dark), var(--color-primary) 55%, #3aa8e0)" }}>
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-xl">
          <p className="font-medium text-[var(--color-text)]">Trop de tentatives de verification.</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Reessayez dans quelques minutes.</p>
        </div>
      </div>
    );
  }

  const result = await verifyReceiptPublic(token);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(150deg, var(--color-primary-dark), var(--color-primary) 55%, #3aa8e0)" }}
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
          <div className="mx-8 mb-8 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-5 text-center">
            <div className="text-lg font-semibold text-[var(--color-danger)]">REÇU INTROUVABLE</div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Aucun reçu ne correspond a ce code de verification.</p>
          </div>
        ) : (
          <div className="px-8 pb-8">
            <div className={`rounded-xl p-5 text-center ${result.valid ? "border border-[var(--color-success)]/30 bg-[var(--color-success)]/10" : "border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10"}`}>
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
