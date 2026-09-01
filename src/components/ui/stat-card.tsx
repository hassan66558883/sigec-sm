import type { ReactNode } from "react";
import Link from "next/link";
import { IconArrowUpRight, IconArrowDownRight } from "@/components/icons";

const TONE_CLASSES: Record<string, string> = {
  primary: "bg-[var(--color-primary-light)] text-[var(--color-primary)] group-hover:bg-[var(--color-primary)]/15",
  gold: "bg-[var(--color-accent-soft)] text-[var(--color-accent)] group-hover:bg-[var(--color-accent)]/20",
  success: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  warning: "bg-amber-50 text-amber-600 group-hover:bg-amber-100",
  danger: "bg-rose-50 text-rose-600 group-hover:bg-rose-100",
};

const TREND_TONE_CLASSES: Record<string, string> = {
  success: "text-emerald-600",
  danger: "text-rose-600",
  neutral: "text-[var(--color-text-muted)]",
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

export type StatCardTrend = {
  pct: number;
  direction: "up" | "down" | "flat";
  tone?: "success" | "danger" | "neutral";
  label?: string;
};

export function StatCard({
  label,
  value,
  hint,
  href,
  icon,
  tone = "primary",
  trend,
  loading = false,
}: {
  label: string;
  value: number | string;
  hint?: ReactNode;
  href?: string;
  icon?: ReactNode;
  tone?: "primary" | "gold" | "success" | "warning" | "danger";
  trend?: StatCardTrend;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-[var(--color-border-subtle)]" />
        <div className="mt-4 h-6 w-20 animate-pulse rounded bg-[var(--color-border-subtle)]" />
        <div className="mt-2 h-3 w-24 animate-pulse rounded bg-[var(--color-border-subtle)]" />
      </div>
    );
  }

  const trendTone = trend ? trend.tone ?? (trend.direction === "up" ? "success" : trend.direction === "down" ? "danger" : "neutral") : undefined;

  return (
    <CardShell href={href}>
      <div className="flex items-start justify-between gap-2">
        {icon && (
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${TONE_CLASSES[tone]}`}>
            <span className="h-5 w-5">{icon}</span>
          </div>
        )}
        {trend && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${TREND_TONE_CLASSES[trendTone!]}`}>
            {trend.direction === "up" ? <IconArrowUpRight className="h-3 w-3" /> : trend.direction === "down" ? <IconArrowDownRight className="h-3 w-3" /> : null}
            {trend.pct > 0 ? "+" : ""}
            {trend.pct}%
          </span>
        )}
      </div>
      <div className={icon || trend ? "mt-4" : undefined}>
        <div className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{value}</div>
        <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
        {hint && <div className="mt-1 text-xs text-[var(--color-text-muted)]/90">{hint}</div>}
        {trend?.label && <div className="mt-1 text-xs text-[var(--color-text-muted)]/90">{trend.label}</div>}
      </div>
    </CardShell>
  );
}
