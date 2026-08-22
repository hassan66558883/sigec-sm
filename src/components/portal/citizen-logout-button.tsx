"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CitizenLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    await fetch("/api/citizen-auth/logout", { method: "POST" });
    router.push("/portail/login");
    router.refresh();
  }

  return (
    <button onClick={onClick} disabled={loading} className="text-xs text-[var(--color-text-muted)] hover:underline disabled:opacity-60">
      {loading ? "..." : "Se deconnecter"}
    </button>
  );
}
