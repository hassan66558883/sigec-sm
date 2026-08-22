"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string };

export function DeclareDivorceForm({ arrondissements, marriages }: { arrondissements: Option[]; marriages: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [marriageId, setMarriageId] = useState("");
  const [decisionReference, setDecisionReference] = useState("");
  const [divorceDate, setDivorceDate] = useState("");
  const [arrondissementId, setArrondissementId] = useState(arrondissements[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/divorces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marriageId, decisionReference, divorceDate, arrondissementId }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la declaration.");
      return;
    }
    setMarriageId("");
    setDecisionReference("");
    setDivorceDate("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + Nouveau dossier de divorce
      </button>
    );
  }

  if (marriages.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Aucun mariage valide disponible pour un divorce.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Mariage concerne</label>
          <select required value={marriageId} onChange={(e) => setMarriageId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="">— Selectionner —</option>
            {marriages.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Reference de la decision</label>
          <input value={decisionReference} onChange={(e) => setDecisionReference(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Date</label>
          <input required type="date" value={divorceDate} onChange={(e) => setDivorceDate(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Arrondissement</label>
          <select required value={arrondissementId} onChange={(e) => setArrondissementId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {arrondissements.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {loading ? "Enregistrement..." : "Declarer"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Annuler
        </button>
      </div>
    </form>
  );
}
