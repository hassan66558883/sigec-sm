"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string };

export function MarketForm({ arrondissements }: { arrondissements: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [arrondissementId, setArrondissementId] = useState(arrondissements[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/markets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, arrondissementId }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la creation.");
      return;
    }
    setName("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + Nouveau marche
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Nom du marche</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="w-56 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Arrondissement</label>
        <select required value={arrondissementId} onChange={(e) => setArrondissementId(e.target.value)} className="w-48 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
          {arrondissements.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
        {loading ? "..." : "Creer"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
        Annuler
      </button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </form>
  );
}
