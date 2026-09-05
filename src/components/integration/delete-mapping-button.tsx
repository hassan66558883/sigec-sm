"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteMappingButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    setLoading(true);
    await fetch(`/api/integration/mapping/${id}`, { method: "DELETE" });
    setLoading(false);
    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="rounded-md border border-[var(--color-danger)]/40 px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10">
        Delete
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={onDelete} disabled={loading} className="rounded-md bg-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
        {loading ? "..." : "Confirm"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-xs text-[var(--color-text-muted)]">Cancel</button>
    </div>
  );
}
