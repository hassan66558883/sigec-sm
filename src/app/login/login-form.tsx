"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible de se connecter.");
        setLoading(false);
        return;
      }
      const next = searchParams.get("next") ?? "/admin";
      router.push(next);
      router.refresh();
    } catch {
      setError("Erreur reseau. Veuillez reessayer.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-[var(--color-danger)]/30 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
          Adresse email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
          placeholder="prenom.nom@ndjamena.td"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md py-2 text-sm font-medium text-white transition disabled:opacity-60"
        style={{ background: "var(--color-primary)" }}
      >
        {loading ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}
