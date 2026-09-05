"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ErrorActions({ id, errorType, status }: { id: string; errorType: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function act(action: string) {
    setLoading(action);
    await fetch(`/api/integration/errors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(null);
    router.refresh();
  }

  if (status === "RESOLVED" || status === "IGNORED") {
    return <span className="text-xs text-[var(--color-text-muted)]">—</span>;
  }

  const canRetry = errorType === "CONNECTION_TEST_FAILED";

  return (
    <div className="flex items-center justify-end gap-2">
      {canRetry && (
        <button onClick={() => act("retry")} disabled={loading !== null} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-60">
          {loading === "retry" ? "..." : "Retry"}
        </button>
      )}
      <button onClick={() => act("resolve")} disabled={loading !== null} className="rounded-md border border-[var(--color-success)]/40 px-2.5 py-1 text-xs font-medium text-[var(--color-success)] hover:bg-[var(--color-success)]/10 disabled:opacity-60">
        {loading === "resolve" ? "..." : "Resolve"}
      </button>
      <button onClick={() => act("ignore")} disabled={loading !== null} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] disabled:opacity-60">
        {loading === "ignore" ? "..." : "Ignore"}
      </button>
    </div>
  );
}
