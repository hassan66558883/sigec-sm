"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Voie de recuperation admin quand un agent perd l'acces a son authenticator
// ET a ses codes de secours (module securite, section 19/24) — meme
// convention que ResetUserPasswordButton : confirmation en ligne, jamais une
// simple bascule silencieuse.
export function DisableUserMfaButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable_mfa" }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Echec de la desactivation.");
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-hover)]"
      >
        Desactiver le MFA
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--color-text-muted)]">Confirmer ?</span>
      <button
        onClick={onConfirm}
        disabled={loading}
        className="rounded-md bg-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
      >
        {loading ? "..." : "Oui"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-xs text-[var(--color-text-muted)]">
        Annuler
      </button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
