"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/translate";

const OPTIONS: { code: Locale; label: string }[] = [
  { code: "fr", label: "FR" },
  { code: "ar", label: "عربي" },
];

export function LanguageSwitcher({ locale, variant = "light" }: { locale: Locale; variant?: "light" | "onDark" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function switchTo(next: Locale) {
    if (next === locale || loading) return;
    setLoading(true);
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    router.refresh();
    setLoading(false);
  }

  const containerClass =
    variant === "onDark"
      ? "flex overflow-hidden rounded-md border border-white/25 text-xs font-medium backdrop-blur-sm"
      : "flex overflow-hidden rounded-md border border-[var(--color-border)] text-xs font-medium";

  return (
    <div className={containerClass}>
      {OPTIONS.map((opt) => {
        const active = locale === opt.code;
        const inactiveClass =
          variant === "onDark"
            ? "text-white/70 hover:bg-white/10 hover:text-white"
            : "text-[var(--color-text-muted)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary-dark)]";
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => switchTo(opt.code)}
            disabled={loading}
            aria-pressed={active}
            className={`flex-1 px-2 py-1.5 transition disabled:opacity-60 ${active ? "text-white" : inactiveClass}`}
            style={active ? { background: variant === "onDark" ? "rgba(255,255,255,0.18)" : "var(--gradient-primary)" } : undefined}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
