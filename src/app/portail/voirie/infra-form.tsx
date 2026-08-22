"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InfraForm() {
  const router = useRouter();
  const [type, setType] = useState("ROAD");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/portal/infrastructure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, description, location }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'envoi.");
      return;
    }
    setDescription("");
    setLocation("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Type de probleme</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="ROAD">Route / nid-de-poule</option>
            <option value="LIGHTING">Eclairage public</option>
            <option value="DRAINAGE">Caniveau</option>
            <option value="WASTE">Dechets</option>
            <option value="PUBLIC_SPACE">Espace public</option>
            <option value="OTHER">Autre</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Localisation</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Description</label>
        <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={loading} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
        {loading ? "Envoi..." : "Signaler"}
      </button>
    </form>
  );
}
