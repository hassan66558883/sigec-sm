"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Credential = { clientId: string; clientSecret: string; scopes: string[] };

export function OAuthCredentialButton({ systemId, hasCredential, scopes }: { systemId: string; hasCredential: boolean; scopes: readonly string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [result, setResult] = useState<Credential | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleScope(scope: string) {
    setSelectedScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  async function onGenerate() {
    setError(null);
    if (selectedScopes.length === 0) {
      setError("Selectionnez au moins un scope.");
      return;
    }
    setLoading("generate");
    const res = await fetch(`/api/integration/systems/${systemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_oauth_credential", scopes: selectedScopes }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "Echec de la generation.");
      return;
    }
    setResult(data.data);
  }

  async function onRotate() {
    setLoading("rotate");
    const res = await fetch(`/api/integration/systems/${systemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rotate_oauth_credential" }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    if (res.ok) setResult(data.data);
  }

  if (result) {
    return (
      <div className="space-y-1 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-2 text-xs">
        <p>client_id / client_secret (copiez maintenant, ne seront plus jamais affiches) :</p>
        <code className="block break-all" dir="ltr">{result.clientId}</code>
        <code className="block break-all" dir="ltr">{result.clientSecret}</code>
        <button
          onClick={() => { setResult(null); setOpen(false); router.refresh(); }}
          className="font-medium text-[var(--color-primary)]"
        >
          J&apos;ai copie les identifiants
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-hover)]">
        {hasCredential ? "Rotate OAuth Credentials" : "Generate OAuth Credentials"}
      </button>
    );
  }

  if (hasCredential) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={onRotate} disabled={loading !== null} className="rounded-md bg-[var(--color-warning)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
          {loading === "rotate" ? "..." : "Confirm Rotate"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-text-muted)]">Cancel</button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-[var(--color-border)] p-2">
      <div className="flex flex-wrap gap-2">
        {scopes.map((scope) => (
          <label key={scope} className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={selectedScopes.includes(scope)} onChange={() => toggleScope(scope)} />
            {scope}
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onGenerate} disabled={loading !== null} className="rounded-md bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
          {loading === "generate" ? "..." : "Generate"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-text-muted)]">Cancel</button>
      </div>
    </div>
  );
}
