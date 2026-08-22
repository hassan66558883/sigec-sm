"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_LABEL: Record<string, string> = {
  NEW: "Nouveau",
  RECEIVED: "Recu",
  ASSIGNED: "Affecte",
  IN_PROGRESS: "En traitement",
  PENDING: "En attente",
  RESOLVED: "Resolu",
  CLOSED: "Cloture",
};
const NEXT_STATUS: Record<string, string[]> = {
  NEW: ["RECEIVED"],
  RECEIVED: ["IN_PROGRESS"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["PENDING", "RESOLVED"],
  PENDING: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export function ComplaintActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!target) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/complaints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", status: target, note }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la mise a jour.");
      return;
    }
    setTarget(null);
    setNote("");
    router.refresh();
  }

  const nextOptions = NEXT_STATUS[status] ?? [];
  if (nextOptions.length === 0) return null;

  if (target) {
    return (
      <div className="space-y-2">
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note pour le citoyen (optionnel)..."
          className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
          rows={2}
        />
        <div className="flex gap-2">
          <button onClick={confirm} disabled={loading} className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
            {loading ? "..." : `Passer a "${STATUS_LABEL[target]}"`}
          </button>
          <button onClick={() => setTarget(null)} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
        </div>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {nextOptions.map((s) => (
        <button key={s} onClick={() => setTarget(s)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}
