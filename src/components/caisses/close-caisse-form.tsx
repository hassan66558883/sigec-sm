"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CloseCaisseForm({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [declaredAmount, setDeclaredAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onConfirm() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/caisses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", declaredAmount: Number(declaredAmount) }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la cloture.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]">
        Cloturer
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        type="number"
        min="0"
        value={declaredAmount}
        onChange={(e) => setDeclaredAmount(e.target.value)}
        placeholder="Montant compte..."
        className="w-32 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
      />
      <button onClick={onConfirm} disabled={loading} className="rounded-md px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
        {loading ? "..." : "Confirmer"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
