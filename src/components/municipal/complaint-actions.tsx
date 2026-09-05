"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export const COMPLAINT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumis",
  RECEIVED: "Recu",
  VERIFYING: "En verification",
  NEEDS_INFO: "A completer",
  ASSIGNED_DEPT: "Affecte",
  ASSIGNED_AGENT: "Assigne",
  IN_PROGRESS: "En cours",
  WAITING: "En attente",
  RESOLVED: "Resolu",
  VALIDATING: "En validation",
  CLOSED: "Cloture",
  REJECTED: "Rejete",
};

// Transitions de statut simples (sans donnee complementaire requise) —
// l'affectation a un service/agent a son propre selecteur ci-dessous,
// et le rejet son propre champ de motif obligatoire.
const SIMPLE_NEXT_STATUS: Record<string, string[]> = {
  SUBMITTED: ["RECEIVED"],
  RECEIVED: ["VERIFYING"],
  VERIFYING: ["NEEDS_INFO"],
  NEEDS_INFO: ["VERIFYING"],
  IN_PROGRESS: ["WAITING", "RESOLVED"],
  WAITING: ["IN_PROGRESS"],
  RESOLVED: ["VALIDATING"],
  VALIDATING: ["CLOSED", "IN_PROGRESS"],
};

async function patchComplaint(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/complaints/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Echec de l'operation.");
  return data;
}

export function ComplaintActions({
  id,
  status,
  departments,
  agents,
  canAssign,
  canReject,
}: {
  id: string;
  status: string;
  departments: { id: string; name: string }[];
  agents: { id: string; name: string }[];
  canAssign: boolean;
  canReject: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"simple" | "department" | "agent" | "reject" | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode(null);
    setTarget(null);
    setNote("");
    setSelectedId("");
    setReason("");
    setError(null);
  }

  async function run(action: () => Promise<unknown>) {
    setLoading(true);
    setError(null);
    try {
      await action();
      reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Echec de l'operation.");
    } finally {
      setLoading(false);
    }
  }

  const simpleOptions = SIMPLE_NEXT_STATUS[status] ?? [];
  const canShowAssignDept = canAssign && status === "VERIFYING";
  const canShowAssignAgent = canAssign && status === "ASSIGNED_DEPT";
  const canShowReject = canReject && status === "VERIFYING";

  if (simpleOptions.length === 0 && !canShowAssignDept && !canShowAssignAgent && !canShowReject) {
    return <p className="text-sm text-[var(--color-text-muted)]">Aucune action disponible — dossier {COMPLAINT_STATUS_LABEL[status] ?? status}.</p>;
  }

  if (mode === "simple" && target) {
    return (
      <div className="space-y-2">
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note pour le citoyen (optionnel)..."
          className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
          rows={2}
        />
        <div className="flex gap-2">
          <button
            onClick={() => run(() => patchComplaint(id, { action: "transition", status: target, note }))}
            disabled={loading}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            style={{ background: "var(--color-primary)" }}
          >
            {loading ? "..." : `Passer a "${COMPLAINT_STATUS_LABEL[target]}"`}
          </button>
          <button onClick={reset} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
        </div>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    );
  }

  if (mode === "department") {
    return (
      <div className="space-y-2">
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
          <option value="">Choisir un service...</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={() => run(() => patchComplaint(id, { action: "assign_department", departmentId: selectedId }))}
            disabled={loading || !selectedId}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            style={{ background: "var(--color-primary)" }}
          >
            {loading ? "..." : "Affecter au service"}
          </button>
          <button onClick={reset} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
        </div>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    );
  }

  if (mode === "agent") {
    return (
      <div className="space-y-2">
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
          <option value="">Choisir un agent...</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={() => run(() => patchComplaint(id, { action: "assign_agent", agentUserId: selectedId }))}
            disabled={loading || !selectedId}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            style={{ background: "var(--color-primary)" }}
          >
            {loading ? "..." : "Assigner l'agent"}
          </button>
          <button onClick={reset} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
        </div>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    );
  }

  if (mode === "reject") {
    return (
      <div className="space-y-2">
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motif du rejet (obligatoire)..."
          className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
          rows={2}
        />
        <div className="flex gap-2">
          <button
            onClick={() => run(() => patchComplaint(id, { action: "transition", status: "REJECTED", rejectionReason: reason }))}
            disabled={loading || !reason.trim()}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            style={{ background: "var(--color-danger)" }}
          >
            {loading ? "..." : "Rejeter le dossier"}
          </button>
          <button onClick={reset} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
        </div>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {simpleOptions.map((s) => (
        <button
          key={s}
          onClick={() => { setMode("simple"); setTarget(s); }}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
        >
          {COMPLAINT_STATUS_LABEL[s]}
        </button>
      ))}
      {canShowAssignDept && (
        <button onClick={() => setMode("department")} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
          Affecter a un service
        </button>
      )}
      {canShowAssignAgent && (
        <button onClick={() => setMode("agent")} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
          Assigner un agent
        </button>
      )}
      {canShowReject && (
        <button onClick={() => setMode("reject")} className="rounded-md border border-[var(--color-danger)]/30 px-3 py-1.5 text-xs font-medium text-[var(--color-danger)] hover:bg-red-50">
          Rejeter
        </button>
      )}
    </div>
  );
}
