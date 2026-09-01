import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";

// Coquille de tableau partagee, adoptee progressivement par les pages de
// liste (Phase 2+) en remplacement du <table> reimplemente a la main sur
// chaque page. Volontairement un composant SERVEUR (pas "use client") :
// `render(row)` est appele pendant le rendu serveur, comme n'importe quel
// autre sous-composant serveur — aucune fonction ne traverse jamais la
// frontiere RSC/client (ce qui casserait, une fonction n'etant pas
// serialisable en tant que prop d'un Client Component). L'interactivite
// (boutons de validation/revocation, etc.) reste geree par les composants
// client existants passes dans `render`, pas par DataTable lui-meme.
export type Column<T> = {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  keyField,
  emptyLabel = "Aucune donnee.",
}: {
  columns: Column<T>[];
  rows: T[];
  keyField: keyof T;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <EmptyState title={emptyLabel} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] ${
                    col.align === "end" ? "text-end" : col.align === "center" ? "text-center" : "text-start"
                  } ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {rows.map((row) => (
              <tr key={String(row[keyField])} className="transition hover:bg-[var(--color-surface-hover)]">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-[var(--color-text)] ${
                      col.align === "end" ? "text-end" : col.align === "center" ? "text-center" : "text-start"
                    } ${col.className ?? ""}`}
                  >
                    {col.render ? col.render(row) : String(row[col.key as keyof T] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
