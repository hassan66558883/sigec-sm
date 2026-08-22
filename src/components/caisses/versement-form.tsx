"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string; expected: number };

export function VersementForm({ caisses }: { caisses: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [caisseId, setCaisseId] = useState(caisses[0]?.id ?? "");
  const [remittedAmount, setRemittedAmount] = useState("");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = caisses.find((c) => c.id === caisseId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/versements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caisseId, remittedAmount: Number(remittedAmount), justification: justification || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'enregistrement.");
      return;
    }
    setRemittedAmount("");
    setJustification("");
    setOpen(false);
    router.refresh();
  }

  if (caisses.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)]">Aucune caisse cloturee en attente de versement.</p>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + Nouveau versement
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Caisse</label>
          <select required value={caisseId} onChange={(e) => setCaisseId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {caisses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
            Montant remis {selected ? `(attendu : ${selected.expected.toLocaleString("fr-FR")} FCFA)` : ""}
          </label>
          <input required type="number" min="0" value={remittedAmount} onChange={(e) => setRemittedAmount(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Justificatif (optionnel)</label>
          <input value={justification} onChange={(e) => setJustification(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {loading ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Annuler
        </button>
      </div>
    </form>
  );
}
