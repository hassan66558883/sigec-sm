"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const [uniqueNumber, setUniqueNumber] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/citizen-auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uniqueNumber, lastName, email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la creation du compte.");
      return;
    }
    router.push("/portail/login");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-[var(--color-danger)]/30 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Numero de dossier citoyen</label>
        <input
          required
          value={uniqueNumber}
          onChange={(e) => setUniqueNumber(e.target.value)}
          placeholder="ex: CIT-2026-XXXXXXXX"
          className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">Indique sur vos actes/certificats delivres par la mairie.</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Nom de famille</label>
        <input
          required
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Email</label>
        <input
          required
          type="email"
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
          minLength={8}
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
        {loading ? "Creation..." : "Creer mon compte"}
      </button>
    </form>
  );
}
