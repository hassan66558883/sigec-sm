"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SystemOption = { id: string; label: string };

export function NewApiKeyForm({ scopes, systems }: { scopes: readonly string[]; systems: SystemOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [systemId, setSystemId] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);

  function toggleScope(scope: string) {
    setSelectedScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedScopes.length === 0) {
      setError("Selectionnez au moins un scope.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/integration/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, systemId: systemId || null, scopes: selectedScopes }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Echec de la creation.");
      return;
    }
    setRawKey(data.data.rawKey);
    setName(""); setSystemId(""); setSelectedScopes([]);
  }

  if (rawKey) {
    return (
      <div className="space-y-3 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-4">
        <p className="text-sm font-medium text-[var(--color-text)]">
          Cle API creee. Copiez-la maintenant — elle ne sera plus jamais affichee.
        </p>
        <code className="block break-all rounded-md bg-[var(--color-bg-subtle)] p-2 text-xs" dir="ltr">{rawKey}</code>
        <button
          onClick={() => { setRawKey(null); setOpen(false); router.refresh(); }}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          J&apos;ai copie la cle
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + Generate API Key
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" placeholder="Orange Money — production" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">System (optional)</label>
          <select value={systemId} onChange={(e) => setSystemId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="">— None —</option>
            {systems.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Scopes</label>
        <div className="flex flex-wrap gap-2">
          {scopes.map((scope) => (
            <label key={scope} className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
              <input type="checkbox" checked={selectedScopes.includes(scope)} onChange={() => toggleScope(scope)} />
              {scope}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {loading ? "Creating..." : "Generate"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Cancel
        </button>
      </div>
    </form>
  );
}
