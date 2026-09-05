"use client";

import { useState } from "react";

type Citizen = { id: string; firstName: string; lastName: string; uniqueNumber: string; phone: string | null };
type Obligation = {
  id: string;
  number: string;
  period: string;
  initialAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  dueDate: string;
  tarif: { label: string };
};
type PaymentResult =
  | { kind: "receipt"; id: string; number: string; amount: number }
  | { kind: "pending"; amount: number };

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export function CollecteClient({ agentId }: { agentId: string | null }) {
  const [search, setSearch] = useState("");
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [selected, setSelected] = useState<Citizen | null>(null);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ESPECES");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSelected(null);
    setResult(null);
    if (!search.trim()) return;
    const res = await fetch(`/api/citizens?search=${encodeURIComponent(search.trim())}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Echec de la recherche.");
      setCitizens([]);
      return;
    }
    setCitizens(data.data);
  }

  async function refreshObligations(citizenId: string) {
    const res = await fetch(`/api/obligations?citizenId=${citizenId}`);
    const data = await res.json();
    setObligations(res.ok ? data.data.filter((o: Obligation) => o.status !== "PAYE" && o.status !== "ANNULE") : []);
  }

  async function selectCitizen(citizen: Citizen) {
    setSelected(citizen);
    setResult(null);
    setError(null);
    await refreshObligations(citizen.id);
  }

  function startPayment(obligation: Obligation) {
    setPayingId(obligation.id);
    setAmount(String(obligation.balance));
    setPhoneNumber(selected?.phone ?? "");
    setExternalReference("");
    setError(null);
  }

  async function confirmPayment(obligation: Obligation) {
    if (!selected) return;
    if (paymentMethod === "MOBILE_MONEY" && (!phoneNumber.trim() || !externalReference.trim())) {
      setError("Numero de telephone et reference de transaction requis pour le Mobile Money.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payerId: selected.id,
        amount: Number(amount),
        paymentMethod,
        obligationId: obligation.id,
        agentId: agentId ?? undefined,
        phoneNumber: paymentMethod === "MOBILE_MONEY" ? phoneNumber.trim() : undefined,
        externalReference: paymentMethod === "MOBILE_MONEY" ? externalReference.trim() : undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Echec de l'enregistrement du paiement.");
      return;
    }
    if (data.data.receipt) {
      setResult({ kind: "receipt", id: data.data.receipt.id, number: data.data.receipt.number, amount: data.data.amount });
    } else {
      // Mobile Money : le paiement reste PENDING jusqu'a confirmation
      // reelle (voir /admin/mobile-money) — jamais de reçu ni de succes simule.
      setResult({ kind: "pending", amount: data.data.amount });
    }
    setPayingId(null);
    // Rafraichir les obligations restantes du contribuable sans effacer la
    // confirmation qu'on vient d'afficher (selectCitizen() la reinitialise).
    await refreshObligations(selected.id);
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <form onSubmit={onSearch} className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom, telephone ou numero contribuable..."
          className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
          Rechercher
        </button>
      </form>

      {!selected && error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      {!selected && citizens.length > 0 && (
        <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          {citizens.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCitizen(c)}
              className="block w-full px-4 py-3 text-left text-sm hover:bg-[var(--color-surface-hover)]"
            >
              <div className="font-medium">{c.firstName} {c.lastName}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{c.uniqueNumber} {c.phone ? `— ${c.phone}` : ""}</div>
            </button>
          ))}
        </div>
      )}

      {result?.kind === "receipt" && (
        <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 p-4 text-center">
          <div className="text-sm font-semibold text-[var(--color-success)]">Paiement enregistre</div>
          <div className="mt-1 text-lg font-semibold">{formatFcfa(result.amount)}</div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">Reçu {result.number}</div>
          <div className="mt-2 flex justify-center gap-3 text-xs">
            <a href={`/api/receipts/${result.id}/qr`} target="_blank" className="text-[var(--color-primary)] hover:underline">Voir le QR</a>
            <a href="/admin/receipts" className="text-[var(--color-primary)] hover:underline">Tous les reçus →</a>
          </div>
        </div>
      )}

      {result?.kind === "pending" && (
        <div className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 p-4 text-center">
          <div className="text-sm font-semibold text-[var(--color-warning)]">Transaction Mobile Money initiee</div>
          <div className="mt-1 text-lg font-semibold">{formatFcfa(result.amount)}</div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            En attente de confirmation — aucun reçu tant que la reception n&apos;est pas confirmee.
          </p>
          <div className="mt-2 text-xs">
            <a href="/admin/mobile-money" className="text-[var(--color-primary)] hover:underline">Suivre la transaction →</a>
          </div>
        </div>
      )}

      {selected && (
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="font-medium">{selected.firstName} {selected.lastName}</div>
            <div className="text-xs text-[var(--color-text-muted)]">{selected.uniqueNumber}</div>
          </div>

          {obligations.length === 0 ? (
            <p className="text-center text-sm text-[var(--color-text-muted)]">Aucune obligation en attente pour ce contribuable.</p>
          ) : (
            obligations.map((o) => (
              <div key={o.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{o.tarif.label}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{o.period}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Solde du</span>
                  <span className="font-semibold text-[var(--color-danger)]">{formatFcfa(o.balance)}</span>
                </div>

                {payingId === o.id ? (
                  <div className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3">
                    <input
                      type="number"
                      min="1"
                      max={o.balance}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
                    />
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
                      <option value="ESPECES">Especes</option>
                      <option value="MOBILE_MONEY">Mobile money</option>
                      <option value="VIREMENT">Virement</option>
                    </select>
                    {paymentMethod === "MOBILE_MONEY" && (
                      <>
                        <input
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="Numero de telephone"
                          className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
                        />
                        <input
                          value={externalReference}
                          onChange={(e) => setExternalReference(e.target.value)}
                          placeholder="Reference de transaction (SMS operateur)"
                          className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
                        />
                      </>
                    )}
                    {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmPayment(o)}
                        disabled={loading}
                        className="flex-1 rounded-md py-2 text-sm font-medium text-white disabled:opacity-60"
                        style={{ background: "var(--color-primary)" }}
                      >
                        {loading ? "Enregistrement..." : "Confirmer le paiement"}
                      </button>
                      <button onClick={() => setPayingId(null)} className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => startPayment(o)}
                    className="mt-3 w-full rounded-md border border-[var(--color-border)] py-1.5 text-sm text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]"
                  >
                    Encaisser
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
