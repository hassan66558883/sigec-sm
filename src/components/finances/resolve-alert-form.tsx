"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResolveAlertForm({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"RESOLUE" | "IGNOREE" | null>(null);

  async function onConfirm(status: "RESOLUE" | "IGNOREE") {
    if (!notes.trim()) {
      setError("Une note est requise.");
      return;
    }
    setLoading(status);
    setError(null);
    const res = await fetch(`/api/fraud/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", resolutionNotes: notes, status }),
    });
    setLoading(null);
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
      <button onClick={() => setOpen(true)} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)] hover:bg-gray-50">
        Traiter
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Note de resolution..."
        className="w-48 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
      />
      <button onClick={() => onConfirm("RESOLUE")} disabled={loading !== null} className="rounded-md bg-[var(--color-success)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
        {loading === "RESOLUE" ? "..." : "Resolue"}
      </button>
      <button onClick={() => onConfirm("IGNOREE")} disabled={loading !== null} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-muted)] disabled:opacity-60">
        {loading === "IGNOREE" ? "..." : "Ignorer"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
