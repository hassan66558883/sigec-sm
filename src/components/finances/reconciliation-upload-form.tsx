"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

// Televersement du releve prestataire/banque (module paiement QR, section
// 31). Format attendu documente directement dans le formulaire — colonnes
// "reference" et "montant" (ou "amount"), "date" optionnelle — plutot que
// de forcer l'agent a deviner un format cible.
export function ReconciliationUploadForm({ providerCodes }: { providerCodes: string[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(providerCodes[0] ?? "MANUAL");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Fichier CSV requis.");
      return;
    }
    if (!periodStart || !periodEnd) {
      setError("Periode requise.");
      return;
    }
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("provider", provider);
    formData.append("periodStart", periodStart);
    formData.append("periodEnd", periodEnd);
    const res = await fetch("/api/reconciliation", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Echec du televersement.");
      return;
    }
    setOpen(false);
    router.push(`/admin/reconciliation/${data.data.id}`);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ background: "var(--gradient-primary)" }}
      >
        + Televerser un releve
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-sm font-medium">Nouveau rapprochement</div>
      <p className="text-xs text-[var(--color-text-muted)]">
        Fichier CSV avec colonnes <code>reference</code> et <code>montant</code> (ou <code>amount</code>), <code>date</code> optionnelle.
      </p>
      <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
        {providerCodes.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-[var(--color-text-muted)]">
          Debut de periode
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1 w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </label>
        <label className="flex-1 text-xs text-[var(--color-text-muted)]">
          Fin de periode
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1 w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </label>
      </div>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="w-full text-sm" />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: "var(--color-primary)" }}
        >
          {loading ? "Traitement..." : "Televerser et rapprocher"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Annuler
        </button>
      </div>
    </form>
  );
}
