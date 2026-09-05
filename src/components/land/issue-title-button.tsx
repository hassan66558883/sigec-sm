"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string };

export function IssueTitleButton({ parcelId, citizens }: { parcelId: string; citizens: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [holderId, setHolderId] = useState(citizens[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onConfirm() {
    if (!holderId) {
      setError("Titulaire requis.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/land/titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcelId, holderId }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'emission.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]">
        Emettre un titre
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select value={holderId} onChange={(e) => setHolderId(e.target.value)} className="w-40 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
        {citizens.map((c) => (
          <option key={c.id} value={c.id}>{c.label}</option>
        ))}
      </select>
      <button onClick={onConfirm} disabled={loading} className="rounded-md bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
        {loading ? "..." : "Confirmer"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
