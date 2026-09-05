"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Stall = { id: string; code: string; status: string; occupant: { firstName: string; lastName: string } | null };
type Option = { id: string; label: string };

const STATUS_LABEL: Record<string, string> = { AVAILABLE: "Disponible", OCCUPIED: "Occupe", RESERVED: "Reserve", SUSPENDED: "Suspendu" };
const STATUS_CLASS: Record<string, string> = {
  AVAILABLE: "bg-[var(--color-neutral-soft)] text-[var(--color-text-muted)]",
  OCCUPIED: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  RESERVED: "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]",
  SUSPENDED: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
};

export function StallPanel({ marketId, stalls, citizens, canManage }: { marketId: string; stalls: Stall[]; citizens: Option[]; canManage: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [occupantId, setOccupantId] = useState(citizens[0]?.id ?? "");

  async function addStall(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/markets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stall: { marketId, code } }),
    });
    setLoading(false);
    setCode("");
    router.refresh();
  }

  async function updateStatus(stallId: string, status: string, withOccupant?: string) {
    await fetch(`/api/markets/stalls/${stallId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, occupantId: withOccupant }),
    });
    setAssigning(null);
    router.refresh();
  }

  function onStatusChange(stallId: string, status: string) {
    if (status === "OCCUPIED") {
      setAssigning(stallId);
      return;
    }
    updateStatus(stallId, status);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {stalls.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
            <Link href={`/admin/markets/stalls/${s.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
              {s.code}
            </Link>
            {canManage ? (
              <select
                value={s.status}
                onChange={(e) => onStatusChange(s.id, e.target.value)}
                className={`rounded-full border-0 px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASS[s.status]}`}
              >
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            ) : (
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
            )}
            {s.occupant && <span className="text-[var(--color-text-muted)]">({s.occupant.firstName} {s.occupant.lastName})</span>}
            {assigning === s.id && (
              <span className="flex items-center gap-1">
                <select value={occupantId} onChange={(e) => setOccupantId(e.target.value)} className="rounded-md border border-[var(--color-border)] px-1 py-0.5 text-xs">
                  {citizens.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <button onClick={() => updateStatus(s.id, "OCCUPIED", occupantId)} className="rounded-md bg-[var(--color-primary)] px-1.5 py-0.5 text-xs text-white">
                  OK
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
      {canManage && (
        <form onSubmit={addStall} className="flex items-center gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code emplacement" className="w-32 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs" />
          <button type="submit" disabled={loading || !code.trim()} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-primary)] disabled:opacity-60">
            + Emplacement
          </button>
        </form>
      )}
    </div>
  );
}
