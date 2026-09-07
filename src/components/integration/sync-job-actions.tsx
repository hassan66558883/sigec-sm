"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncJobActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function onRunNow() {
    setLoading("run");
    setResult(null);
    const res = await fetch(`/api/integration/sync/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run_now" }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    setResult(res.ok ? `${data.data.ok ? "OK" : "Echec"} — ${data.data.sent} enregistrement(s) envoye(s)` : (data.error ?? "Echec."));
    router.refresh();
  }

  async function onToggleStatus() {
    setLoading("toggle");
    await fetch(`/api/integration/sync/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", status: status === "ACTIVE" ? "DISABLED" : "ACTIVE" }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        <button onClick={onRunNow} disabled={loading !== null} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-60">
          {loading === "run" ? "..." : "Run Sync Now"}
        </button>
        <button onClick={onToggleStatus} disabled={loading !== null} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-60">
          {loading === "toggle" ? "..." : status === "ACTIVE" ? "Disable" : "Enable"}
        </button>
      </div>
      {result && <span className="text-[10px] text-[var(--color-text-muted)]">{result}</span>}
    </div>
  );
}
