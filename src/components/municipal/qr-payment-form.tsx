"use client";

import { useState } from "react";

type Obligation = { id: string; number: string; period: string; balance: number };

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

// Formulaire de paiement depuis le scan QR public (section 9/41) — aucune
// authentification. Un seul fournisseur (providerCode) est propose tant
// qu'un seul est enregistre (MANUAL) ; le selecteur n'apparait que si
// listProviderCodes() en renvoie plusieurs un jour, sans changement de
// composant necessaire (voir src/lib/services/payment-provider.ts).
export function QrPaymentForm({ token, obligation, providerCodes }: { token: string; obligation: Obligation; providerCodes: string[] }) {
  const [step, setStep] = useState<"idle" | "confirming" | "done">("idle");
  const [providerCode, setProviderCode] = useState(providerCodes[0] ?? "MANUAL");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; reference: string } | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pay/${token}/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ obligationId: obligation.id, providerCode, phoneNumber: phoneNumber.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Echec de l'operation.");
      if (data.data.redirectUrl) {
        window.location.href = data.data.redirectUrl;
        return;
      }
      setResult({ status: data.data.status, reference: data.data.paymentId });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Echec de l'operation.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "done" && result) {
    return (
      <div className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 p-3 text-sm">
        <p className="font-medium text-[var(--color-text)]">Paiement enregistre — en attente de confirmation.</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Un agent municipal confirmera ce paiement des reception. Conservez cette page ou notez la reference de votre facture ({obligation.number}) pour tout suivi.
        </p>
      </div>
    );
  }

  if (step === "confirming") {
    return (
      <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-3">
        {providerCodes.length > 1 && (
          <select value={providerCode} onChange={(e) => setProviderCode(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {providerCodes.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="Numero de telephone (facultatif)"
          className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={loading}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            style={{ background: "var(--color-primary)" }}
          >
            {loading ? "..." : `Confirmer — ${formatFcfa(obligation.balance)}`}
          </button>
          <button onClick={() => setStep("idle")} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
        </div>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setStep("confirming")}
      className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
      style={{ background: "var(--color-primary)" }}
    >
      Payer {formatFcfa(obligation.balance)}
    </button>
  );
}
