"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Reinitialisation de mot de passe par un administrateur (module securite,
// section 19) — seule voie de recuperation pour un compte bloque puisque
// ce projet n'a aucun envoi d'email (decision explicite : pas de flux
// "mot de passe oublie"). L'admin saisit lui-meme le nouveau mot de passe
// (meme convention que la creation de compte), jamais un mot de passe
// genere puis affiche en clair a l'ecran.
export function ResetUserPasswordButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onConfirm() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_password", newPassword: password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Echec de la reinitialisation.");
      return;
    }
    setDone(true);
    setPassword("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setDone(false);
        }}
        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-hover)]"
      >
        Reinitialiser le mot de passe
      </button>
    );
  }

  if (done) {
    return <span className="text-xs text-[var(--color-success)]">Mot de passe reinitialise — communiquez-le a l&apos;utilisateur hors ligne.</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Nouveau mot de passe (10+ car., maj/min/chiffre)"
        className="w-64 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
      />
      <button
        onClick={onConfirm}
        disabled={loading || !password}
        className="rounded-md bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
      >
        {loading ? "..." : "Confirmer"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
