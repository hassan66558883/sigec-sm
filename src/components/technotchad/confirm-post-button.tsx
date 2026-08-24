"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Confirmation inline (jamais de prompt()/confirm() natif — meme convention
// que ReasonActionButton), pour une action POST sans motif requis.
export function ConfirmPostButton({
  endpoint,
  label,
  confirmLabel = "Confirmer",
  variant = "danger",
}: {
  endpoint: string;
  label: string;
  confirmLabel?: string;
  variant?: "danger" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setLoading(true);
    setError(null);
    const res = await fetch(endpoint, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'operation.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const color = variant === "danger" ? "var(--color-danger)" : "var(--color-primary)";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border px-2.5 py-1 text-xs font-medium transition hover:bg-red-50"
        style={{ borderColor: `${color}4d`, color }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--color-text-muted)]">Confirmer ?</span>
      <button
        onClick={onConfirm}
        disabled={loading}
        className="rounded-md px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
        style={{ background: color }}
      >
        {loading ? "..." : confirmLabel}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-text-muted)]">
        Annuler
      </button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
