"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Comment = { id: string; authorType: string; message: string; createdAt: string };

export function CommentThread({ complaintId, comments }: { complaintId: string; comments: Comment[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/portal/complaints/${complaintId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'envoi.");
      return;
    }
    setMessage("");
    router.refresh();
  }

  if (comments.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-[var(--color-border-subtle)] pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Echanges</p>
      <ul className="space-y-1.5">
        {comments.map((c) => (
          <li
            key={c.id}
            className={`max-w-[85%] rounded-md px-2.5 py-1.5 text-xs ${
              c.authorType === "STAFF" ? "bg-[var(--color-primary-light)] text-[var(--color-text)]" : "ml-auto bg-[var(--color-bg-subtle)] text-[var(--color-text)]"
            }`}
          >
            <p>{c.message}</p>
            <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
              {c.authorType === "STAFF" ? "Mairie" : "Vous"} — {new Date(c.createdAt).toLocaleString("fr-FR")}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Repondre..."
          className="flex-1 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs"
        />
        <button onClick={send} disabled={loading || !message.trim()} className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          Envoyer
        </button>
      </div>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
