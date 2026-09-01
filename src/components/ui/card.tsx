import type { ReactNode } from "react";

// Coquille de carte generique (design system premium) : fond blanc, coins
// arrondis, ombre douce, espacement genereux. Additive uniquement — les
// pages existantes qui reimplementent ce meme motif inline ne sont pas
// touchees par ce fichier ; elles migreront module par module (Phase 2+).
export function Card({
  children,
  className = "",
  padding = "p-5",
  hoverable = false,
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm ${padding} ${
        hoverable ? "transition hover:-translate-y-0.5 hover:shadow-md" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="text-[var(--color-text-muted)]">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-[var(--color-text)]">{title}</h2>
          {subtitle && <p className="truncate text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = "p-5" }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
