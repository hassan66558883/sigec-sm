"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string };

export function DeclareMarriageForm({
  arrondissements,
  citizens,
  regimes,
}: {
  arrondissements: Option[];
  citizens: Option[];
  regimes: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [husbandId, setHusbandId] = useState("");
  const [wifeId, setWifeId] = useState("");
  const [marriageDate, setMarriageDate] = useState("");
  const [marriagePlace, setMarriagePlace] = useState("");
  const [regimeId, setRegimeId] = useState("");
  const [witness1, setWitness1] = useState("");
  const [witness2, setWitness2] = useState("");
  const [arrondissementId, setArrondissementId] = useState(arrondissements[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/marriages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        husbandId,
        wifeId,
        marriageDate,
        marriagePlace,
        regimeId: regimeId || null,
        arrondissementId,
        witnesses: [
          witness1.trim() ? { name: witness1.trim(), role: "Temoin de l'epoux" } : null,
          witness2.trim() ? { name: witness2.trim(), role: "Temoin de l'epouse" } : null,
        ].filter(Boolean),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la declaration.");
      return;
    }
    setHusbandId("");
    setWifeId("");
    setMarriageDate("");
    setMarriagePlace("");
    setWitness1("");
    setWitness2("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + Nouveau dossier de mariage
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Epoux</label>
          <select required value={husbandId} onChange={(e) => setHusbandId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="">— Selectionner —</option>
            {citizens.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Epouse</label>
          <select required value={wifeId} onChange={(e) => setWifeId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="">— Selectionner —</option>
            {citizens.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Regime matrimonial</label>
          <select value={regimeId} onChange={(e) => setRegimeId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="">— Non specifie —</option>
            {regimes.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Date</label>
          <input required type="date" value={marriageDate} onChange={(e) => setMarriageDate(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Lieu</label>
          <input required value={marriagePlace} onChange={(e) => setMarriagePlace(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
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
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Temoin de l&apos;epoux</label>
          <input value={witness1} onChange={(e) => setWitness1(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Temoin de l&apos;epouse</label>
          <input value={witness2} onChange={(e) => setWitness2(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
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
