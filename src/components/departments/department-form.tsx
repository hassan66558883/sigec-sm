"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DepartmentForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code, description }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la creation.");
      return;
    }
    setName("");
    setCode("");
    setDescription("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Nom de la direction</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Direction de l'Etat Civil" className="w-64 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Code</label>
        <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex: DEC" className="w-28 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-64 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
        {loading ? "Ajout..." : "Ajouter"}
      </button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </form>
  );
}
