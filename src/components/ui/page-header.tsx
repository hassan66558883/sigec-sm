import type { ReactNode } from "react";

// Generalisation de PageHero/TechnoPageHeader : meme langage visuel, variante
// selon l'espace (institutionnel bleu/or vs TECHNOTCHAD indigo). Les anciens
// composants restent en place (utilises uniquement par ce qu'ils etaient deja
// avant migration) — aucune page existante n'est cassee par cet ajout.
export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  action,
  variant = "primary",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: "primary" | "technotchad";
}) {
  const background =
    variant === "technotchad"
      ? "linear-gradient(120deg, var(--tc-grad-from), var(--tc-grad-via) 55%, var(--tc-grad-to))"
      : "linear-gradient(120deg, var(--color-primary-dark), var(--color-primary) 60%, #3aa8e0)";
  const blobColor = variant === "technotchad" ? "rgb(139 92 246 / 0.18)" : "rgb(242 169 0 / 0.18)";

  return (
    <div className="relative overflow-hidden rounded-2xl px-6 py-7 text-white shadow-md sm:px-8" style={{ background }}>
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full blur-2xl" style={{ background: blobColor }} />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
              <span className="h-5 w-5 text-white">{icon}</span>
            </div>
          )}
          <div>
            {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{eyebrow}</div>}
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            {description && <p className="mt-1.5 max-w-2xl text-sm text-white/80">{description}</p>}
          </div>
        </div>
        {action && <div className="relative">{action}</div>}
      </div>
    </div>
  );
}

// En-tete leger pour les pages de liste/module (par opposition au grand
// bandeau degrade de PageHeader, reserve aux vrais tableaux de bord) —
// titre + description + actions, sans fond colore. Evite la fatigue
// visuelle d'un degrade repete sur chacune des ~40 pages de liste de
// l'application.
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
