"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Champ de motif inline plutot qu'un prompt() natif du navigateur.
export function RevokeButton({ endpoint, label = "Annuler" }: { endpoint: string; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (!reason.trim()) {
      setError("Un motif est requis.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", reason }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'annulation.");
      return;
    }
    setOpen(false);
    setReason("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-[var(--color-danger)]/30 px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/10"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motif..."
        className="w-40 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
      />
      <button
        onClick={onConfirm}
        disabled={loading}
        className="rounded-md bg-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
      >
        {loading ? "..." : "Confirmer"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-text-muted)]">
        Annuler
      </button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
