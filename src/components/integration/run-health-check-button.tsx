"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunHealthCheckButton({ systemId }: { systemId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onRun() {
    setLoading(true);
    await fetch(`/api/integration/systems/${systemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run_health_check" }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button onClick={onRun} disabled={loading} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-60">
      {loading ? "Checking..." : "Run Health Check Now"}
    </button>
  );
}
