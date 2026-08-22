"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarkReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button onClick={onClick} disabled={loading} className="text-xs text-[var(--color-primary)] hover:underline disabled:opacity-60">
      {loading ? "..." : "Marquer comme lue"}
    </button>
  );
}

export function MarkAllReadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    await fetch("/api/notifications", { method: "PATCH" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button onClick={onClick} disabled={loading} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-gray-50 disabled:opacity-60">
      {loading ? "..." : "Tout marquer comme lu"}
    </button>
  );
}
