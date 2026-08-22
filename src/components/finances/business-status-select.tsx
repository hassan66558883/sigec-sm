"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUSES = ["ACTIVE", "INACTIVE", "FERMEE", "SUSPENDUE", "EN_ATTENTE_DE_VALIDATION"];

export function BusinessStatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onChange(next: string) {
    setLoading(true);
    await fetch(`/api/businesses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", status: next }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <select
      value={status}
      disabled={loading}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs disabled:opacity-60"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
