"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ValidateButton({ endpoint, label = "Valider" }: { endpoint: string; label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "validate" }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la validation.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        disabled={loading}
        className="rounded-md border border-[var(--color-success)]/30 px-2.5 py-1 text-xs font-medium text-[var(--color-success)] transition hover:bg-green-50 disabled:opacity-60"
      >
        {loading ? "..." : label}
      </button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
