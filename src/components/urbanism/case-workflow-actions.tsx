"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CaseWorkflowActions({
  id,
  status,
  canReview,
  canInspect,
  canDecide,
}: {
  id: string;
  status: string;
  canReview: boolean;
  canInspect: boolean;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState<"inspect" | "approve" | "reject" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: string, withNotes: boolean) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/urbanism/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes: withNotes ? notes : undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'action.");
      return;
    }
    setShowNotes(null);
    setNotes("");
    router.refresh();
  }

  if (showNotes) {
    return (
      <div className="space-y-2">
        <textarea
          autoFocus
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes / motif..."
          className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
          rows={2}
        />
        <div className="flex gap-2">
          <button
            onClick={() => send(showNotes, true)}
            disabled={loading}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            style={{ background: showNotes === "reject" ? "var(--color-danger)" : "var(--color-primary)" }}
          >
            {loading ? "..." : "Confirmer"}
          </button>
          <button onClick={() => setShowNotes(null)} className="text-xs text-[var(--color-text-muted)]">
            Annuler
          </button>
        </div>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "SUBMITTED" && canReview && (
        <button onClick={() => send("review", false)} disabled={loading} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-60">
          Debuter l&apos;instruction
        </button>
      )}
      {status === "UNDER_REVIEW" && canInspect && (
        <button onClick={() => setShowNotes("inspect")} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-hover)]">
          Marquer controle effectue
        </button>
      )}
      {status === "INSPECTED" && canDecide && (
        <>
          <button onClick={() => setShowNotes("approve")} className="rounded-md border border-[var(--color-success)]/30 px-3 py-1.5 text-xs font-medium text-[var(--color-success)] hover:bg-[var(--color-success)]/10">
            Approuver
          </button>
          <button onClick={() => setShowNotes("reject")} className="rounded-md border border-[var(--color-danger)]/30 px-3 py-1.5 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10">
            Rejeter
          </button>
        </>
      )}
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
