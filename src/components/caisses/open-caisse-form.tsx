"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string };

export function OpenCaisseForm({ agents }: { agents: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/caisses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'ouverture.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (agents.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)]">Aucun agent disponible (tous ont deja une caisse ouverte, ou aucun agent actif).</p>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + Ouvrir une caisse
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Agent</label>
        <select required value={agentId} onChange={(e) => setAgentId(e.target.value)} className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
          {agents.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
        {loading ? "Ouverture..." : "Ouvrir"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
        Annuler
      </button>
    </form>
  );
}
