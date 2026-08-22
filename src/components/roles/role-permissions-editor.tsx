"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Permission = { id: string; module: string; action: string; code: string };

export function RolePermissionsEditor({
  roleId,
  roleCode,
  allPermissions,
  initialPermissionIds,
  editable,
}: {
  roleId: string;
  roleCode: string;
  allPermissions: Permission[];
  initialPermissionIds: string[];
  editable: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPermissionIds));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const byModule = new Map<string, Permission[]>();
  for (const p of allPermissions) {
    if (!byModule.has(p.module)) byModule.set(p.module, []);
    byModule.get(p.module)!.push(p);
  }

  function toggle(id: string) {
    if (!editable) return;
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
    setDirty(true);
  }

  async function onSave() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/roles/${roleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionIds: Array.from(selected) }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'enregistrement.");
      return;
    }
    setDirty(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {!editable && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Les permissions du role {roleCode} ne sont pas modifiables.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from(byModule.entries()).map(([module, perms]) => (
          <div key={module} className="rounded-md border border-[var(--color-border)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">{module}</div>
            <div className="flex flex-wrap gap-2">
              {perms.map((p) => (
                <label key={p.id} className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  {p.action}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {editable && (
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={loading || !dirty}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--color-primary)" }}
          >
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
          {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
        </div>
      )}
    </div>
  );
}
