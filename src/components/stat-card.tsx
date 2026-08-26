import type { ReactNode } from "react";
import Link from "next/link";

const TONE_CLASSES: Record<string, string> = {
  primary: "bg-[var(--color-primary-light)] text-[var(--color-primary)] group-hover:bg-[var(--color-primary)]/15",
  gold: "bg-[var(--color-accent-soft)] text-[var(--color-accent)] group-hover:bg-[var(--color-accent)]/20",
  success: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  warning: "bg-amber-50 text-amber-600 group-hover:bg-amber-100",
  danger: "bg-rose-50 text-rose-600 group-hover:bg-rose-100",
};

function CardShell({ children, href }: { children: ReactNode; href?: string }) {
  const className =
    "group relative flex flex-col justify-between overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return <div className={className}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  href,
  icon,
  tone = "primary",
}: {
  label: string;
  value: number | string;
  hint?: ReactNode;
  href?: string;
  icon?: ReactNode;
  tone?: "primary" | "gold" | "success" | "warning" | "danger";
}) {
  return (
    <CardShell href={href}>
      {icon && (
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${TONE_CLASSES[tone]}`}>
          <span className="h-5 w-5">{icon}</span>
        </div>
      )}
      <div className={icon ? "mt-4" : undefined}>
        <div className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{value}</div>
        <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
        {hint && <div className="mt-1 text-xs text-[var(--color-text-muted)]/90">{hint}</div>}
      </div>
    </CardShell>
  );
}
