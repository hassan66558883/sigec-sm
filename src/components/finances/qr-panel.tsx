"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";

async function postJson(url: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Echec de l'operation.");
  return data;
}

type ActiveQr = { id: string; token: string; issuedAt: string };

export function QrPanel({
  entityType,
  entityId,
  activeQr,
  canGenerate,
  canRevoke,
  canReplace,
}: {
  entityType: string;
  entityId: string;
  activeQr: ActiveQr | null;
  canGenerate: boolean;
  canRevoke: boolean;
  canReplace: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"revoke" | "replace" | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode(null);
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

  return (
    <Card padding="p-0">
      <CardHeader title="QR code de paiement" />
      <div className="space-y-3 px-5 py-4">
        {!activeQr ? (
          <>
            <p className="text-sm text-[var(--color-text-muted)]">Aucun QR actif pour cet emplacement.</p>
            {canGenerate && (
              <button
                onClick={() => run(() => postJson("/api/qr/generate", "POST", { entityType, entityId }))}
                disabled={loading}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                style={{ background: "var(--color-primary)" }}
              >
                {loading ? "..." : "Generer un QR"}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- image generee a la volee par une route API, pas un asset statique optimisable */}
              <img src={`/api/qr/${activeQr.id}/image`} alt="QR code de paiement" className="h-32 w-32 rounded-md border border-[var(--color-border)]" />
              <div className="text-sm">
                <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Emis le</div>
                <div>{new Date(activeQr.issuedAt).toLocaleDateString("fr-FR")}</div>
                <a href={`/api/qr/${activeQr.id}/image`} download className="mt-2 inline-block text-xs text-[var(--color-primary)] hover:underline">
                  Telecharger l&apos;image
                </a>
              </div>
            </div>

            {mode === null && (
              <div className="flex gap-2">
                {canRevoke && (
                  <button onClick={() => setMode("revoke")} className="rounded-md border border-[var(--color-danger)]/30 px-3 py-1.5 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10">
                    Revoquer
                  </button>
                )}
                {canReplace && (
                  <button onClick={() => setMode("replace")} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-hover)]">
                    Remplacer
                  </button>
                )}
              </div>
            )}

            {mode && (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={mode === "revoke" ? "Motif de la revocation (obligatoire)..." : "Motif du remplacement (perte, vol, degradation — obligatoire)..."}
                  className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => run(() => postJson(`/api/qr/${activeQr.id}`, "PATCH", { action: mode, reason }))}
                    disabled={loading || !reason.trim()}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                    style={{ background: mode === "revoke" ? "var(--color-danger)" : "var(--color-primary)" }}
                  >
                    {loading ? "..." : mode === "revoke" ? "Confirmer la revocation" : "Confirmer le remplacement"}
                  </button>
                  <button onClick={reset} className="text-xs text-[var(--color-text-muted)]">Annuler</button>
                </div>
              </div>
            )}
          </>
        )}
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    </Card>
  );
}
