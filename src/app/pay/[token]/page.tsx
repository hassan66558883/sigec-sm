import { headers } from "next/headers";
import { resolveQrToken } from "@/lib/services/qr-codes";
import { listProviderCodes } from "@/lib/services/payment-provider";
import { isRateLimited } from "@/lib/rate-limit";
import { QrPaymentForm } from "@/components/municipal/qr-payment-form";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

// Meme budget que les autres pages de scan/verification publiques
// (/verify/[token], /verify-receipt/[token] — audit securite/performance
// 2026-09-02).
const SCAN_WINDOW_MS = 5 * 60 * 1000;
const SCAN_MAX_ATTEMPTS = 20;

// Page de scan QR publique (module paiement QR, section 8) : AUCUNE
// authentification requise (section 41 — payer sans compte). Identifie
// l'entite et affiche le solde calcule a la volee, jamais un montant fige
// dans le QR (regle absolue section 2). Le paiement passe par le meme
// fournisseur pluggable que le portail citoyen (payment-provider.ts) —
// avec seulement MANUAL enregistre a ce jour, "Payer" enregistre une
// intention reelle (PENDING) en attente de confirmation par un agent,
// jamais un faux succes instantane (regle absolue : ne jamais simuler une
// confirmation prestataire).
export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const hdrs = await headers();
  const ipAddress = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? "unknown";

  if (isRateLimited(`qr-scan:${ipAddress}`, SCAN_WINDOW_MS, SCAN_MAX_ATTEMPTS)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10" style={{ background: "linear-gradient(150deg, var(--color-primary-dark), var(--color-primary) 55%, #3aa8e0)" }}>
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-xl">
          <p className="font-medium text-[var(--color-text)]">Trop de tentatives.</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Reessayez dans quelques minutes.</p>
        </div>
      </div>
    );
  }

  const result = await resolveQrToken(token);
  const providerCodes = listProviderCodes();

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
          <h1 className="text-base font-semibold text-[var(--color-text)]">Paiement municipal</h1>
          <p className="text-xs text-[var(--color-text-muted)]">SIGEC-SM — Ville de N&apos;Djamena</p>
        </div>

        {!result.found ? (
          <div className="mx-8 mb-8 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-5 text-center">
            <div className="text-lg font-semibold text-[var(--color-danger)]">QR INTROUVABLE</div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Ce code ne correspond a aucun enregistrement SIGEC-SM.</p>
          </div>
        ) : !result.valid ? (
          <div className="px-8 pb-8">
            <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-5 text-center">
              <div className="text-lg font-semibold text-[var(--color-danger)]">QR {result.status === "REPLACED" ? "REMPLACE" : "REVOQUE"}</div>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Ce code n&apos;est plus valide. Contactez la mairie si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-8 pb-8">
            <div className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 p-4 text-center">
              <div className="text-sm font-semibold text-[var(--color-success)]">✓ ETABLISSEMENT ENREGISTRE</div>
            </div>

            <div className="mt-4 space-y-0 text-sm">
              <div className="border-b border-[var(--color-border-subtle)] py-2.5">
                <div className="text-xs uppercase text-[var(--color-text-muted)]">Reference</div>
                <div className="font-medium text-[var(--color-text)]">{result.reference}</div>
              </div>
              <div className="border-b border-[var(--color-border-subtle)] py-2.5">
                <div className="text-xs uppercase text-[var(--color-text-muted)]">Etablissement</div>
                <div className="font-medium text-[var(--color-text)]">{result.name}</div>
              </div>
              <div className="border-b border-[var(--color-border-subtle)] py-2.5">
                <div className="text-xs uppercase text-[var(--color-text-muted)]">Localisation</div>
                <div className="font-medium text-[var(--color-text)]">
                  {result.arrondissementName}
                  {result.quartierName ? ` — ${result.quartierName}` : ""}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">A payer</div>
              {result.outstanding.obligations.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">Aucune facture en attente pour cet emplacement.</p>
              ) : (
                <>
                  <ul className="mt-2 space-y-3 text-sm">
                    {result.outstanding.obligations.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[var(--color-text-muted)]">{o.number} ({o.period})</div>
                          <div className="font-medium text-[var(--color-text)]">{formatFcfa(o.balance)}</div>
                        </div>
                        <QrPaymentForm token={token} obligation={o} providerCodes={providerCodes} />
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex justify-between border-t border-[var(--color-border-subtle)] pt-3">
                    <span className="text-sm font-semibold text-[var(--color-text)]">Total</span>
                    <span className="text-lg font-bold text-[var(--color-primary)]">{formatFcfa(result.outstanding.total)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
