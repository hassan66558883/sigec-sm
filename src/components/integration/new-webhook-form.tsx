"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SystemOption = { id: string; label: string };

export function NewWebhookForm({ events, systems }: { events: readonly string[]; systems: SystemOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [event, setEvent] = useState(events[0]);
  const [systemId, setSystemId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/integration/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, event, systemId: systemId || null }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Echec de la creation.");
      return;
    }
    setSecret(data.data.secret);
    setUrl("");
  }

  if (secret) {
    return (
      <div className="space-y-3 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-4">
        <p className="text-sm font-medium text-[var(--color-text)]">
          Webhook cree. Communiquez ce secret au systeme destinataire pour qu&apos;il verifie la signature — il ne sera plus jamais affiche.
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
        + New Webhook
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Webhook URL</label>
          <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" placeholder="https://partner.example.td/webhooks/sigec" dir="ltr" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Event</label>
          <select value={event} onChange={(e) => setEvent(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {events.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">System (optional)</label>
          <select value={systemId} onChange={(e) => setSystemId(e.target.value)} className="w-64 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="">— None —</option>
            {systems.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {loading ? "Creating..." : "Create Webhook"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Cancel
        </button>
      </div>
    </form>
  );
}
