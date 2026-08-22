"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string };

export function PaymentForm({
  citizens,
  taxTypes,
  businesses,
  arrondissements,
  canCollectCentral,
}: {
  citizens: Option[];
  taxTypes: Option[];
  businesses: Option[];
  arrondissements: Option[];
  canCollectCentral: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [payerId, setPayerId] = useState(citizens[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ESPECES");
  const [taxTypeId, setTaxTypeId] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [scope, setScope] = useState<"LOCAL" | "CENTRAL">("LOCAL");
  const [arrondissementId, setArrondissementId] = useState(arrondissements[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payerId,
        amount: Number(amount),
        paymentMethod,
        taxTypeId: taxTypeId || null,
        businessId: businessId || null,
        arrondissementId: scope === "CENTRAL" ? null : arrondissementId,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'enregistrement.");
      return;
    }
    setAmount("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + Enregistrer un paiement
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Payeur</label>
          <select required value={payerId} onChange={(e) => setPayerId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {citizens.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Montant (FCFA)</label>
          <input required type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Mode de paiement</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="ESPECES">Especes</option>
            <option value="MOBILE_MONEY">Mobile money</option>
            <option value="VIREMENT">Virement</option>
            <option value="AUTRE">Autre</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Type de taxe</label>
          <select value={taxTypeId} onChange={(e) => setTaxTypeId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="">— Non categorise —</option>
            {taxTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Commerce concerne (optionnel)</label>
          <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="">— Aucun —</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Origine de la recette</label>
          <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="LOCAL">Arrondissement</option>
            {canCollectCentral && <option value="CENTRAL">Mairie Centrale</option>}
          </select>
        </div>
        {scope === "LOCAL" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Arrondissement</label>
            <select required value={arrondissementId} onChange={(e) => setArrondissementId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
              {arrondissements.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {loading ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Annuler
        </button>
      </div>
    </form>
  );
}
