"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WebhookActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function onTest() {
    setLoading("test");
    setTestResult(null);
    const res = await fetch(`/api/integration/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    setTestResult(res.ok ? `Statut: ${data.data.status}${data.data.responseStatus ? ` (HTTP ${data.data.responseStatus})` : ""}` : (data.error ?? "Echec."));
    router.refresh();
  }

  async function onToggleStatus() {
    setLoading("toggle");
    await fetch(`/api/integration/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", status: status === "ACTIVE" ? "DISABLED" : "ACTIVE" }),
    });
    setLoading(null);
    router.refresh();
  }

  async function onDelete() {
    setLoading("delete");
    await fetch(`/api/integration/webhooks/${id}`, { method: "DELETE" });
    setLoading(null);
    setConfirmingDelete(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        <button onClick={onTest} disabled={loading !== null} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-60">
          {loading === "test" ? "..." : "Test Webhook"}
        </button>
        <button onClick={onToggleStatus} disabled={loading !== null} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-60">
          {loading === "toggle" ? "..." : status === "ACTIVE" ? "Disable" : "Enable"}
        </button>
        {!confirmingDelete ? (
          <button onClick={() => setConfirmingDelete(true)} className="rounded-md border border-[var(--color-danger)]/40 px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10">
            Delete
          </button>
        ) : (
          <>
            <button onClick={onDelete} disabled={loading !== null} className="rounded-md bg-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
              {loading === "delete" ? "..." : "Confirm"}
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="text-xs text-[var(--color-text-muted)]">Cancel</button>
          </>
        )}
      </div>
      {testResult && <span className="text-[10px] text-[var(--color-text-muted)]">{testResult}</span>}
    </div>
  );
}
