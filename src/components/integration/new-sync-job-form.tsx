"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SystemOption = { id: string; label: string };

export function NewSyncJobForm({ systems }: { systems: SystemOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [systemId, setSystemId] = useState(systems[0]?.id ?? "");
  const [syncType, setSyncType] = useState("SCHEDULED");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [endpointPath, setEndpointPath] = useState("/sync/citizens");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/integration/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemId, entityType: "CITIZENS", syncType, endpointPath,
        intervalMinutes: syncType === "SCHEDULED" ? intervalMinutes : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Echec de la creation.");
      return;
    }
    setSecret(data.data.secret);
  }

  if (systems.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Connectez d&apos;abord un systeme avec une URL de base avant de creer une synchronisation.</p>;
  }

  if (secret) {
    return (
      <div className="space-y-3 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-4">
        <p className="text-sm font-medium text-[var(--color-text)]">
          Synchronisation creee. Communiquez ce secret au systeme destinataire pour qu&apos;il verifie la signature de chaque lot — il ne sera plus jamais affiche.
        </p>
        <code className="block break-all rounded-md bg-[var(--color-bg-subtle)] p-2 text-xs" dir="ltr">{secret}</code>
        <button
          onClick={() => { setSecret(null); setOpen(false); router.refresh(); }}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          J&apos;ai copie le secret
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + New Sync Job
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">System</label>
          <select value={systemId} onChange={(e) => setSystemId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {systems.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Sync Type</label>
          <select value={syncType} onChange={(e) => setSyncType(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="MANUAL">MANUAL</option>
          </select>
        </div>
        {syncType === "SCHEDULED" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Interval (minutes)</label>
            <input type="number" min={1} value={intervalMinutes} onChange={(e) => setIntervalMinutes(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Endpoint Path</label>
          <input value={endpointPath} onChange={(e) => setEndpointPath(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm font-mono" dir="ltr" />
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {loading ? "Creating..." : "Create Sync Job"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Cancel
        </button>
      </div>
    </form>
  );
}
