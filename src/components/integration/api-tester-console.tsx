"use client";

import { useState } from "react";

type Endpoint = { method: string; path: string; body: unknown };

export function ApiTesterConsole({ endpoints }: { endpoints: readonly Endpoint[] }) {
  const [method, setMethod] = useState(endpoints[0].method);
  const [path, setPath] = useState(endpoints[0].path);
  const [apiKey, setApiKey] = useState("");
  const [body, setBody] = useState(endpoints[0].body ? JSON.stringify(endpoints[0].body, null, 2) : "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: number; timeMs: number; body: string; correlationId: string | null } | null>(null);

  function selectEndpoint(index: number) {
    const ep = endpoints[index];
    setMethod(ep.method);
    setPath(ep.path);
    setBody(ep.body ? JSON.stringify(ep.body, null, 2) : "");
    setResult(null);
  }

  async function onSend() {
    setLoading(true);
    setResult(null);
    const start = performance.now();
    try {
      const res = await fetch(path, {
        method,
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
        },
        body: method !== "GET" && body ? body : undefined,
      });
      const timeMs = Math.round(performance.now() - start);
      const text = await res.text();
      setResult({ status: res.status, timeMs, body: text, correlationId: res.headers.get("X-Correlation-Id") });
    } catch (error) {
      setResult({ status: 0, timeMs: Math.round(performance.now() - start), body: error instanceof Error ? error.message : "Erreur reseau.", correlationId: null });
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Endpoint</label>
          <select onChange={(e) => selectEndpoint(Number(e.target.value))} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {endpoints.map((ep, i) => <option key={`${ep.method}-${ep.path}`} value={i}>{ep.method} {ep.path}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Method</label>
          <input value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" dir="ltr" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Path (remplacez {"{id}"} si necessaire)</label>
          <input value={path} onChange={(e) => setPath(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm font-mono" dir="ltr" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Authorization (cle API — jamais enregistree)</label>
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sigk_..." className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm font-mono" dir="ltr" />
      </div>

      {method !== "GET" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Body (JSON)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm font-mono" dir="ltr" />
        </div>
      )}

      <button onClick={onSend} disabled={loading} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
        {loading ? "Envoi..." : "Send"}
      </button>

      {result && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4">
          <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
            <span className={`font-bold ${result.status >= 200 && result.status < 300 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>Status: {result.status || "—"}</span>
            <span className="text-[var(--color-text-muted)]">Response Time: {result.timeMs} ms</span>
            {result.correlationId && <span className="font-mono text-[var(--color-text-muted)]">{result.correlationId}</span>}
          </div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs" dir="ltr">{result.body}</pre>
        </div>
      )}
    </div>
  );
}
