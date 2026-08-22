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
type ReceiptResult = { id: string; number: string; amount: number };

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export function CollecteClient() {
  const [search, setSearch] = useState("");
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [selected, setSelected] = useState<Citizen | null>(null);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ESPECES");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptResult | null>(null);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSelected(null);
    setReceipt(null);
    if (!search.trim()) return;
    const res = await fetch(`/api/citizens?search=${encodeURIComponent(search.trim())}`);
    const data = await res.json();
    setCitizens(res.ok ? data.data : []);
  }

  async function refreshObligations(citizenId: string) {
    const res = await fetch(`/api/obligations?citizenId=${citizenId}`);
    const data = await res.json();
    setObligations(res.ok ? data.data.filter((o: Obligation) => o.status !== "PAYE" && o.status !== "ANNULE") : []);
  }

  async function selectCitizen(citizen: Citizen) {
    setSelected(citizen);
    setReceipt(null);
    setError(null);
    await refreshObligations(citizen.id);
  }

  function startPayment(obligation: Obligation) {
    setPayingId(obligation.id);
    setAmount(String(obligation.balance));
    setError(null);
  }

  async function confirmPayment(obligation: Obligation) {
    if (!selected) return;
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
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Echec de l'enregistrement du paiement.");
      return;
    }
    setReceipt({ id: data.data.receipt.id, number: data.data.receipt.number, amount: data.data.amount });
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

      {!selected && citizens.length > 0 && (
        <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          {citizens.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCitizen(c)}
              className="block w-full px-4 py-3 text-left text-sm hover:bg-gray-50"
            >
              <div className="font-medium">{c.firstName} {c.lastName}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{c.uniqueNumber} {c.phone ? `— ${c.phone}` : ""}</div>
            </button>
          ))}
        </div>
      )}

      {receipt && (
        <div className="rounded-lg border border-[var(--color-success)]/30 bg-green-50 p-4 text-center">
          <div className="text-sm font-semibold text-[var(--color-success)]">Paiement enregistre</div>
          <div className="mt-1 text-lg font-semibold">{formatFcfa(receipt.amount)}</div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">Reçu {receipt.number}</div>
          <div className="mt-2 flex justify-center gap-3 text-xs">
            <a href={`/api/receipts/${receipt.id}/qr`} target="_blank" className="text-[var(--color-primary)] hover:underline">Voir le QR</a>
            <a href="/admin/receipts" className="text-[var(--color-primary)] hover:underline">Tous les reçus →</a>
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
                    className="mt-3 w-full rounded-md border border-[var(--color-border)] py-1.5 text-sm text-[var(--color-primary)] hover:bg-gray-50"
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
