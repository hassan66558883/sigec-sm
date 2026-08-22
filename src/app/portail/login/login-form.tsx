"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/citizen-auth/login", {
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
    router.push("/portail");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-[var(--color-danger)]/30 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Email</label>
        <input
          required
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Mot de passe</label>
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ background: "var(--color-primary)" }}
      >
        {loading ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}
