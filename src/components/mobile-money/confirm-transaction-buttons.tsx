"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ConfirmTransactionButtons({ id }: { id: string }) {
  const router = useRouter();
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<"confirm" | "fail" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setLoading("confirm");
    setError(null);
    const res = await fetch(`/api/mobile-money/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la confirmation.");
      return;
    }
    router.refresh();
  }

  async function fail() {
    if (!reason.trim()) {
      setError("Un motif est requis.");
      return;
    }
    setLoading("fail");
    setError(null);
    const res = await fetch(`/api/mobile-money/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fail", reason }),
    });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec.");
      return;
    }
    setFailing(false);
    router.refresh();
  }

  if (failing) {
    return (
      <div className="flex items-center gap-2">
        <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif..." className="w-36 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs" />
        <button onClick={fail} disabled={loading !== null} className="rounded-md bg-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
          {loading === "fail" ? "..." : "Confirmer l'echec"}
        </button>
        <button onClick={() => setFailing(false)} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
        {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={confirm} disabled={loading !== null} className="rounded-md border border-[var(--color-success)]/30 px-2.5 py-1 text-xs font-medium text-[var(--color-success)] hover:bg-green-50 disabled:opacity-60">
        {loading === "confirm" ? "..." : "Confirmer reception"}
      </button>
      <button onClick={() => setFailing(true)} className="rounded-md border border-[var(--color-danger)]/30 px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-red-50">
        Echec
      </button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
