"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApiKeyActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  async function onRotate() {
    setLoading(true);
    const res = await fetch(`/api/integration/api-keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rotate" }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) setNewRawKey(data.data.rawKey);
  }

  async function onRevoke() {
    setLoading(true);
    await fetch(`/api/integration/api-keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    });
    setLoading(false);
    setConfirmingRevoke(false);
    router.refresh();
  }

  if (newRawKey) {
    return (
      <div className="space-y-1 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-2 text-xs">
        <p>Nouvelle cle (copiez-la maintenant) :</p>
        <code className="block break-all" dir="ltr">{newRawKey}</code>
        <button onClick={() => { setNewRawKey(null); router.refresh(); }} className="font-medium text-[var(--color-primary)]">
          J&apos;ai copie la cle
        </button>
      </div>
    );
  }

  if (status !== "ACTIVE") return <span className="text-xs text-[var(--color-text-muted)]">—</span>;

  return (
    <div className="flex items-center justify-end gap-2">
      <button onClick={onRotate} disabled={loading} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-60">
        {loading ? "..." : "Rotate"}
      </button>
      {!confirmingRevoke ? (
        <button onClick={() => setConfirmingRevoke(true)} className="rounded-md border border-[var(--color-danger)]/40 px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10">
          Revoke
        </button>
      ) : (
        <>
          <button onClick={onRevoke} disabled={loading} className="rounded-md bg-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
            {loading ? "..." : "Confirm"}
          </button>
          <button onClick={() => setConfirmingRevoke(false)} className="text-xs text-[var(--color-text-muted)]">Cancel</button>
        </>
      )}
    </div>
  );
}
