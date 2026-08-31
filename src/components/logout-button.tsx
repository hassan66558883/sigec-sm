"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({
  label = "Se deconnecter",
  loadingLabel = "Deconnexion...",
  variant = "light",
}: {
  label?: string;
  loadingLabel?: string;
  variant?: "light" | "onDark";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const variantClass =
    variant === "onDark"
      ? "border-white/15 text-white/75 hover:border-white/30 hover:bg-white/10 hover:text-white"
      : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-gray-50";

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full rounded-md border px-3 py-2 text-start text-sm transition disabled:opacity-60 ${variantClass}`}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
