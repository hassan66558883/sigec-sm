"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string };

const EMPLACEMENT_TYPES = [
  { value: "BOUTIQUE", label: "Boutique" },
  { value: "MARCHE", label: "Marche" },
  { value: "ETAL", label: "Etal" },
  { value: "AUTRE", label: "Autre" },
];
const PERIODICITIES = [
  { value: "JOURNALIERE", label: "Journaliere" },
  { value: "HEBDOMADAIRE", label: "Hebdomadaire" },
  { value: "MENSUELLE", label: "Mensuelle" },
  { value: "TRIMESTRIELLE", label: "Trimestrielle" },
  { value: "SEMESTRIELLE", label: "Semestrielle" },
  { value: "ANNUELLE", label: "Annuelle" },
  { value: "AUTRE", label: "Autre" },
];

export function TariffForm({ activities }: { activities: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [activityId, setActivityId] = useState("");
  const [emplacementType, setEmplacementType] = useState("BOUTIQUE");
  const [periodicity, setPeriodicity] = useState("MENSUELLE");
  const [amount, setAmount] = useState("");
  const [legalReference, setLegalReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/tariffs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        label,
        category: category || undefined,
        activityId: activityId || null,
        emplacementType,
        periodicity,
        amount: Number(amount),
        legalReference: legalReference || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la creation.");
      return;
    }
    setCode("");
    setLabel("");
    setCategory("");
    setAmount("");
    setLegalReference("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + Nouveau tarif / revision
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <p className="text-xs text-[var(--color-text-muted)]">
        Si le code existe deja et est actif, une nouvelle version est creee et l&apos;ancienne est cloturee — aucun tarif n&apos;est jamais ecrase.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Code</label>
          <input required value={code} onChange={(e) => setCode(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Libelle</label>
          <input required value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Categorie</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Type d&apos;emplacement</label>
          <select value={emplacementType} onChange={(e) => setEmplacementType(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {EMPLACEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Activite (optionnel)</label>
          <select value={activityId} onChange={(e) => setActivityId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="">— Toutes —</option>
            {activities.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Periodicite</label>
          <select value={periodicity} onChange={(e) => setPeriodicity(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {PERIODICITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Montant (FCFA)</label>
          <input required type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Reference reglementaire</label>
          <input value={legalReference} onChange={(e) => setLegalReference(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
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
