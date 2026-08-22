"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function IssueCertificateButton({
  sourceType,
  sourceId,
  label = "Emettre le certificat",
}: {
  sourceType: "birth" | "recognition" | "marriage" | "death";
  sourceId: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType, sourceId }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'emission.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        disabled={loading}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        style={{ background: "var(--color-accent)" }}
      >
        {loading ? "Emission..." : label}
      </button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
