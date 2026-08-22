"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ValidateVersementButtons({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function decide(approve: boolean) {
    setLoading(approve ? "approve" : "reject");
    await fetch(`/api/versements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "validate", approve }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => decide(true)}
        disabled={loading !== null}
        className="rounded-md border border-[var(--color-success)]/30 px-2.5 py-1 text-xs font-medium text-[var(--color-success)] hover:bg-green-50 disabled:opacity-60"
      >
        {loading === "approve" ? "..." : "Valider"}
      </button>
      <button
        onClick={() => decide(false)}
        disabled={loading !== null}
        className="rounded-md border border-[var(--color-danger)]/30 px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-red-50 disabled:opacity-60"
      >
        {loading === "reject" ? "..." : "Rejeter"}
      </button>
    </div>
  );
}
