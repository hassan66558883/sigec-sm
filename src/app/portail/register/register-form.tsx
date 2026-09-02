"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-white/30 bg-white/95 py-2.5 px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-white focus:bg-white focus:ring-2 focus:ring-[var(--color-accent)]/50";
const labelClass = "mb-1.5 block text-sm font-medium text-white/90";

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
      {error && <div className="rounded-lg border border-red-300/40 bg-red-500/15 px-3 py-2 text-sm text-red-50">{error}</div>}
      <div>
        <label className={labelClass}>Numero de dossier citoyen</label>
        <input required value={uniqueNumber} onChange={(e) => setUniqueNumber(e.target.value)} placeholder="ex: CIT-2026-XXXXXXXX" className={inputClass} dir="ltr" />
        <p className="mt-1 text-xs text-white/60">Indique sur vos actes/certificats delivres par la mairie.</p>
      </div>
      <div>
        <label className={labelClass}>Nom de famille</label>
        <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Email</label>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} dir="ltr" />
      </div>
      <div>
        <label className={labelClass}>Mot de passe</label>
        <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} dir="ltr" />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-[var(--color-primary-dark)] shadow-lg transition hover:bg-white/90 disabled:opacity-60"
      >
        {loading ? "Creation..." : "Creer mon compte"}
      </button>
    </form>
  );
}
