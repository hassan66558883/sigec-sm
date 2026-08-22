"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string };

export function AssignZoneForm({ agentId, quartiers, markets }: { agentId: string; quartiers: Option[]; markets: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [zoneType, setZoneType] = useState<"QUARTIER" | "MARCHE">("QUARTIER");
  const [quartierId, setQuartierId] = useState(quartiers[0]?.id ?? "");
  const [marketId, setMarketId] = useState(markets[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/collectors/affectations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        zoneType,
        quartierId: zoneType === "QUARTIER" ? quartierId : undefined,
        marketId: zoneType === "MARCHE" ? marketId : undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'affectation.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-medium text-[var(--color-primary)] hover:underline">
        + Affecter une zone
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-[var(--color-border)] p-2">
      <div>
        <label className="mb-1 block text-[10px] font-medium text-[var(--color-text-muted)]">Type de zone</label>
        <select value={zoneType} onChange={(e) => setZoneType(e.target.value as typeof zoneType)} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
          <option value="QUARTIER">Quartier</option>
          <option value="MARCHE">Marche</option>
        </select>
      </div>
      {zoneType === "QUARTIER" ? (
        <div>
          <label className="mb-1 block text-[10px] font-medium text-[var(--color-text-muted)]">Quartier</label>
          <select required value={quartierId} onChange={(e) => setQuartierId(e.target.value)} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
            {quartiers.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-[10px] font-medium text-[var(--color-text-muted)]">Marche</label>
          <select required value={marketId} onChange={(e) => setMarketId(e.target.value)} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
            {markets.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      )}
      <button type="submit" disabled={loading} className="rounded-md px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
        {loading ? "..." : "Affecter"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </form>
  );
}
