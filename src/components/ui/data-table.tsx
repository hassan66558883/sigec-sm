import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { TableInteractive } from "@/components/ui/table-interactive";

// Coquille de tableau partagee, adoptee par les pages de liste en
// remplacement du <table> reimplemente a la main sur chaque page.
// DataTable lui-meme reste un composant SERVEUR : `render(row)` est appele
// ici pendant le rendu serveur, comme n'importe quel autre sous-composant
// serveur. Le tri/la pagination (qui exigent de l'etat cote client) sont
// delegues a TableInteractive, qui ne recoit que du JSX deja resolu et des
// valeurs primitives (jamais une fonction) — respecte la meme contrainte
// RSC que le reste de l'app. 100% retro-compatible : les ~40 pages qui
// utilisaient deja <DataTable columns rows keyField /> sans les nouvelles
// props continuent de fonctionner a l'identique (pagination desactivee de
// facto tant que `pageSize` n'est pas fourni, aucune colonne triable tant
// qu'aucune n'a `sortable: true`).
export type Column<T> = {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
};

const DEFAULT_PAGE_SIZE = 25;

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  keyField,
  emptyLabel = "Aucune donnee.",
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  columns: Column<T>[];
  rows: T[];
  keyField: keyof T;
  emptyLabel?: string;
  // Passer `null` desactive la pagination (toutes les lignes affichees) —
  // conserve l'ancien comportement pour les pages qui en ont besoin.
  pageSize?: number | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <EmptyState title={emptyLabel} />
      </div>
    );
  }

  const preparedRows = rows.map((row) => {
    const cells: Record<string, ReactNode> = {};
    const sortValues: Record<string, string | number> = {};
    for (const col of columns) {
      cells[col.key] = col.render ? col.render(row) : String(row[col.key as keyof T] ?? "");
      if (col.sortable) {
        sortValues[col.key] = col.sortValue ? col.sortValue(row) : String(row[col.key as keyof T] ?? "");
      }
    }
    return { rowKey: String(row[keyField]), cells, sortValues };
  });

  const columnMeta = columns.map((c) => ({ key: c.key, header: c.header, align: c.align, className: c.className, sortable: c.sortable }));

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <TableInteractive columns={columnMeta} rows={preparedRows} pageSize={pageSize ?? undefined} />
    </div>
  );
}
