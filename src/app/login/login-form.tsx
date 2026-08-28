"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { makeT, type Dictionary } from "@/lib/i18n/translate";
import { IconMail, IconLock } from "@/components/icons";

export function LoginForm({ dict }: { dict: Dictionary }) {
  const t = makeT(dict);
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
        setError(data.error ?? t("login.errorGeneric"));
        setLoading(false);
        return;
      }
      const next = searchParams.get("next") ?? "/admin";
      router.push(next);
      router.refresh();
    } catch {
      setError(t("login.errorNetwork"));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-300/40 bg-red-500/15 px-3 py-2 text-sm text-red-50">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white/90">
          {t("login.email")}
        </label>
        <div className="relative">
          <IconMail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/30 bg-white/95 py-2.5 pl-9 pr-3 text-sm text-[var(--color-text)] outline-none transition focus:border-white focus:bg-white focus:ring-2 focus:ring-[var(--color-accent)]/50"
            placeholder="prenom.nom@ndjamena.td"
            dir="ltr"
          />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-white/90">
          {t("login.password")}
        </label>
        <div className="relative">
          <IconLock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/30 bg-white/95 py-2.5 pl-9 pr-3 text-sm text-[var(--color-text)] outline-none transition focus:border-white focus:bg-white focus:ring-2 focus:ring-[var(--color-accent)]/50"
            dir="ltr"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-[var(--color-primary-dark)] shadow-lg transition hover:bg-white/90 disabled:opacity-60"
      >
        {loading ? t("login.submitting") : t("login.submit")}
      </button>
    </form>
  );
}
