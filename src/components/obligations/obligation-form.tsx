"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string };

export function ObligationForm({
  citizens,
  businesses,
  stalls,
  tariffs,
}: {
  citizens: Option[];
  businesses: Option[];
  stalls: Option[];
  tariffs: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [citizenId, setCitizenId] = useState(citizens[0]?.id ?? "");
  const [emplacement, setEmplacement] = useState<"AUCUN" | "BOUTIQUE" | "ETAL">("AUCUN");
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [marketStallId, setMarketStallId] = useState(stalls[0]?.id ?? "");
  const [tarifId, setTarifId] = useState(tariffs[0]?.id ?? "");
  const [period, setPeriod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/obligations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        citizenId,
        businessId: emplacement === "BOUTIQUE" ? businessId : null,
        marketStallId: emplacement === "ETAL" ? marketStallId : null,
        tarifId,
        period,
        dueDate,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la creation.");
      return;
    }
    setPeriod("");
    setDueDate("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + Generer une obligation
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Contribuable</label>
          <select required value={citizenId} onChange={(e) => setCitizenId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {citizens.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Emplacement</label>
          <select value={emplacement} onChange={(e) => setEmplacement(e.target.value as typeof emplacement)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="AUCUN">Aucun (contribuable seul)</option>
            <option value="BOUTIQUE">Boutique</option>
            <option value="ETAL">Etal de marche</option>
          </select>
        </div>
        {emplacement === "BOUTIQUE" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Boutique</label>
            <select required value={businessId} onChange={(e) => setBusinessId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
        )}
        {emplacement === "ETAL" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Etal</label>
            <select required value={marketStallId} onChange={(e) => setMarketStallId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
              {stalls.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Tarif applicable</label>
          <select required value={tarifId} onChange={(e) => setTarifId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {tariffs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Periode</label>
          <input required placeholder="ex: 2026-08" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Echeance</label>
          <input required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {loading ? "Creation..." : "Generer"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Annuler
        </button>
      </div>
    </form>
  );
}
