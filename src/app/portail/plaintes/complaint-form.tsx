"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ComplaintForm() {
  const router = useRouter();
  const [category, setCategory] = useState("VOIRIE");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/portal/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, description }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'envoi.");
      return;
    }
    setDescription("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Categorie</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="VOIRIE">Voirie</option>
            <option value="PROPRETE">Proprete</option>
            <option value="ECLAIRAGE">Eclairage</option>
            <option value="EAU">Eau</option>
            <option value="SECURITE">Securite</option>
            <option value="AUTRE">Autre</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Description</label>
        <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={loading} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
        {loading ? "Envoi..." : "Deposer la plainte"}
      </button>
    </form>
  );
}
