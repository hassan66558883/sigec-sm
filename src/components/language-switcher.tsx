"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/translate";

const OPTIONS: { code: Locale; label: string }[] = [
  { code: "fr", label: "FR" },
  { code: "ar", label: "عربي" },
];

export function LanguageSwitcher({ locale }: { locale: Locale }) {
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

  return (
    <div className="flex overflow-hidden rounded-md border border-[var(--color-border)] text-xs font-medium">
      {OPTIONS.map((opt) => (
        <button
          key={opt.code}
          type="button"
          onClick={() => switchTo(opt.code)}
          disabled={loading}
          aria-pressed={locale === opt.code}
          className={`flex-1 px-2 py-1.5 transition disabled:opacity-60 ${
            locale === opt.code
              ? "text-white"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary-dark)]"
          }`}
          style={locale === opt.code ? { background: "var(--gradient-primary)" } : undefined}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
