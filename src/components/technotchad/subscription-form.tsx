"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { IconPlus } from "./icons";

type Client = { id: string; legalName: string };
type Product = { id: string; name: string };
type Plan = { id: string; productId: string; name: string; price: number };

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] shadow-sm transition placeholder:text-[var(--color-text-muted)]/60 focus:border-[var(--tc-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--tc-accent-ring)]";
const labelClass = "mb-1.5 block text-xs font-medium text-[var(--color-text-muted)]";

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
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className={labelClass}>Client</label>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.legalName}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Produit</label>
        <select
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setPlanId("");
          }}
          className={inputClass}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Plan</label>
        <select value={selectedPlan?.id ?? ""} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
          {plansForProduct.length === 0 && <option value="">Aucun plan pour ce produit</option>}
          {plansForProduct.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Debut</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Fin</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Montant (XAF)</label>
        <input
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={selectedPlan ? String(selectedPlan.price) : "0"}
          className={inputClass}
        />
      </div>
      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={loading || !selectedPlan}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
          style={{ background: "linear-gradient(120deg, var(--tc-grad-from), var(--tc-grad-via))" }}
        >
          <IconPlus className="h-4 w-4" />
          {loading ? "Creation..." : "Creer l'abonnement"}
        </button>
        {error && <span className="ml-3 text-xs text-[var(--color-danger)]">{error}</span>}
      </div>
    </form>
  );
}
