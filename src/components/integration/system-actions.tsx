"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// TEST CONNECTION (section 5) — declenche une vraie requete HTTP cote
// serveur (voir testIntegrationSystemConnection) et rafraichit la ligne avec
// le resultat reel (jamais un succes simule).
export function TestConnectionButton({ systemId }: { systemId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onTest() {
    setLoading(true);
    setResult(null);
    const res = await fetch(`/api/integration/systems/${systemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test_connection" }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setResult({ ok: false, message: data.error ?? "Echec du test." });
    } else {
      setResult({ ok: data.data.ok, message: data.data.message });
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={onTest} disabled={loading} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-60">
        {loading ? "Testing..." : "Test Connection"}
      </button>
      {result && (
        <span className={`text-[10px] ${result.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>{result.message}</span>
      )}
    </div>
  );
}

export function ToggleSystemEnabledButton({ systemId, enabled }: { systemId: string; enabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onToggle() {
    setLoading(true);
    await fetch(`/api/integration/systems/${systemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_enabled", enabled: !enabled }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
        enabled ? "border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10" : "border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      {loading ? "..." : enabled ? "Disable" : "Enable"}
    </button>
  );
}
