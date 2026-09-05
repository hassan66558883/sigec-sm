"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApplicationActions({ id, canApprove, canReject }: { id: string; canApprove: boolean; canReject: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setLoading("approve");
    setError(null);
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'approbation.");
      return;
    }
    router.refresh();
  }

  async function reject() {
    if (!reason.trim()) {
      setError("Un motif est requis.");
      return;
    }
    setLoading("reject");
    setError(null);
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", reason }),
    });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec du rejet.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {canApprove && (
          <button
            onClick={approve}
            disabled={loading !== null}
            className="rounded-md border border-[var(--color-success)]/30 px-2.5 py-1 text-xs font-medium text-[var(--color-success)] hover:bg-[var(--color-success)]/10 disabled:opacity-60"
          >
            {loading === "approve" ? "..." : "Approuver"}
          </button>
        )}
        {canReject && !rejecting && (
          <button
            onClick={() => setRejecting(true)}
            className="rounded-md border border-[var(--color-danger)]/30 px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
          >
            Rejeter
          </button>
        )}
      </div>
      {rejecting && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif..."
            className="w-40 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
          />
          <button onClick={reject} disabled={loading !== null} className="rounded-md bg-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
            {loading === "reject" ? "..." : "Confirmer"}
          </button>
        </div>
      )}
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
