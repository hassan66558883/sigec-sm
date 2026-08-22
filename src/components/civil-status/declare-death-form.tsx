"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string };

export function DeclareDeathForm({ arrondissements, citizens }: { arrondissements: Option[]; citizens: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deceasedId, setDeceasedId] = useState("");
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [placeOfDeath, setPlaceOfDeath] = useState("");
  const [cause, setCause] = useState("");
  const [declarantName, setDeclarantName] = useState("");
  const [declarantRelation, setDeclarantRelation] = useState("");
  const [arrondissementId, setArrondissementId] = useState(arrondissements[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/deaths", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deceasedId, dateOfDeath, placeOfDeath, cause, declarantName, declarantRelation, arrondissementId }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la declaration.");
      return;
    }
    setDeceasedId("");
    setDateOfDeath("");
    setPlaceOfDeath("");
    setCause("");
    setDeclarantName("");
    setDeclarantRelation("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + Declarer un deces
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Personne decedee</label>
          <select required value={deceasedId} onChange={(e) => setDeceasedId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="">— Selectionner —</option>
            {citizens.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Arrondissement</label>
          <select required value={arrondissementId} onChange={(e) => setArrondissementId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {arrondissements.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Date du deces</label>
          <input required type="date" value={dateOfDeath} onChange={(e) => setDateOfDeath(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Lieu du deces</label>
          <input required value={placeOfDeath} onChange={(e) => setPlaceOfDeath(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
            Cause (optionnel — seulement si legalement requis)
          </label>
          <input value={cause} onChange={(e) => setCause(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Nom du declarant</label>
          <input required value={declarantName} onChange={(e) => setDeclarantName(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Lien avec le defunt</label>
          <input value={declarantRelation} onChange={(e) => setDeclarantRelation(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
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
