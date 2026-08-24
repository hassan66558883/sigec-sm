"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Client = { id: string; legalName: string };
type Product = { id: string; name: string };
type Plan = { id: string; productId: string; name: string; price: number };

export function TechnoSubscriptionForm({
  clients,
  products,
  plans,
}: {
  clients: Client[];
  products: Product[];
  plans: Plan[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const plansForProduct = useMemo(() => plans.filter((p) => p.productId === productId), [plans, productId]);
  const selectedPlan = plansForProduct.find((p) => p.id === planId) ?? plansForProduct[0];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId || !productId || !selectedPlan) {
      setError("Client, produit et plan sont requis.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/technotchad/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        productId,
        planId: selectedPlan.id,
        startDate,
        endDate,
        amount: amount ? Number(amount) : selectedPlan.price,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la creation.");
      return;
    }
    setAmount("");
    router.refresh();
  }

  if (clients.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Ajoutez d&apos;abord un client TECHNOTCHAD.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Client</label>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-56 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.legalName}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Produit</label>
        <select
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setPlanId("");
          }}
          className="w-40 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Plan</label>
        <select value={selectedPlan?.id ?? ""} onChange={(e) => setPlanId(e.target.value)} className="w-56 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
          {plansForProduct.length === 0 && <option value="">Aucun plan pour ce produit</option>}
          {plansForProduct.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Debut</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Fin</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Montant (XAF)</label>
        <input
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={selectedPlan ? String(selectedPlan.price) : "0"}
          className="w-32 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
        />
      </div>
      <button type="submit" disabled={loading || !selectedPlan} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
        {loading ? "Creation..." : "Creer l'abonnement"}
      </button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </form>
  );
}
