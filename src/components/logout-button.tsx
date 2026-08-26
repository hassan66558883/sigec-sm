"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ label = "Se deconnecter", loadingLabel = "Deconnexion..." }: { label?: string; loadingLabel?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-start text-sm text-[var(--color-text-muted)] transition hover:bg-gray-50 disabled:opacity-60"
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
