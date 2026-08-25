import type { ReactNode } from "react";

export function TechnoPageHeader({
  eyebrow = "TECHNOTCHAD",
  title,
  description,
  icon,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="tc-animate-in relative overflow-hidden rounded-2xl px-6 py-7 text-white shadow-lg sm:px-8"
      style={{ background: "linear-gradient(120deg, var(--tc-grad-from), var(--tc-grad-via) 55%, var(--tc-grad-to))" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-white/10 blur-2xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
              <span className="h-5 w-5 text-white">{icon}</span>
            </div>
          )}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{eyebrow}</div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            {description && <p className="mt-1.5 max-w-2xl text-sm text-white/80">{description}</p>}
          </div>
        </div>
        {action && <div className="relative">{action}</div>}
      </div>
    </div>
  );
}
