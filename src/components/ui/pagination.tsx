import Link from "next/link";

// Pagination server-side (Link -> nouvelle requete, nouvelle page de
// resultats) — a ne pas confondre avec la pagination client de
// TableInteractive (qui re-decoupe un tableau deja recupere en entier).
// Utilisee sur les listes a fort volume ou`take` seul ne suffit plus a
// garantir l'acces a l'integralite des enregistrements (voir audit
// performance 2026-09-02) : le service renvoie desormais { rows, total }
// via skip/take cote base, et cette barre navigue entre les pages reelles.
export function Pagination({
  page,
  totalPages,
  makeHref,
}: {
  page: number;
  totalPages: number;
  makeHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-xs text-[var(--color-text-muted)] shadow-sm">
      <span className="font-medium text-[var(--color-text)]">
        Page {page} / {totalPages}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={makeHref(page - 1)}
            className="rounded-md border border-[var(--color-border)] px-2.5 py-1 font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]"
          >
            ← Precedent
          </Link>
        ) : (
          <span className="rounded-md border border-[var(--color-border)] px-2.5 py-1 font-medium opacity-40">← Precedent</span>
        )}
        {page < totalPages ? (
          <Link
            href={makeHref(page + 1)}
            className="rounded-md border border-[var(--color-border)] px-2.5 py-1 font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]"
          >
            Suivant →
          </Link>
        ) : (
          <span className="rounded-md border border-[var(--color-border)] px-2.5 py-1 font-medium opacity-40">Suivant →</span>
        )}
      </div>
    </div>
  );
}
