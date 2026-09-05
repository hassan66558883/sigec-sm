"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResolveReconciliationEntry({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onConfirm() {
    if (!notes.trim()) {
      setError("Une note est requise.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/reconciliation/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolutionNotes: notes }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la resolution.");
      return;
    }
    setOpen(false);
    setNotes("");
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]">
        Investiguer
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Note d'investigation..."
        className="w-48 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
      />
      <button onClick={onConfirm} disabled={loading} className="rounded-md bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
        {loading ? "..." : "Confirmer"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
