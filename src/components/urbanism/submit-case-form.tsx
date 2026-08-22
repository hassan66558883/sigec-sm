"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string };

export function SubmitCaseForm({ parcels, citizens, arrondissements }: { parcels: Option[]; citizens: Option[]; arrondissements: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"BUILDING_PERMIT" | "DEMOLITION_PERMIT">("BUILDING_PERMIT");
  const [parcelId, setParcelId] = useState(parcels[0]?.id ?? "");
  const [applicantId, setApplicantId] = useState(citizens[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [arrondissementId, setArrondissementId] = useState(arrondissements[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/urbanism/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, parcelId, applicantId, description, arrondissementId }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la soumission.");
      return;
    }
    setDescription("");
    setOpen(false);
    router.refresh();
  }

  if (parcels.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Aucune parcelle enregistree pour deposer une demande.</p>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + Nouvelle demande
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="BUILDING_PERMIT">Permis de construire</option>
            <option value="DEMOLITION_PERMIT">Autorisation de demolition</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Parcelle</label>
          <select required value={parcelId} onChange={(e) => setParcelId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {parcels.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Demandeur</label>
          <select required value={applicantId} onChange={(e) => setApplicantId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
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
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Description du projet</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {loading ? "Envoi..." : "Soumettre"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Annuler
        </button>
      </div>
    </form>
  );
}
