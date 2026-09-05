import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowRight } from "./icons";

export function TechnoStatCard({
  label,
  value,
  hint,
  href,
  icon,
  tone = "indigo",
}: {
  label: string;
  value: number | string;
  hint?: string;
  href: string;
  icon: ReactNode;
  tone?: "indigo" | "violet" | "emerald" | "amber";
}) {
  const toneClasses: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:group-hover:bg-indigo-500/25",
    violet: "bg-violet-50 text-violet-600 group-hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-300 dark:group-hover:bg-violet-500/25",
    emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:group-hover:bg-emerald-500/25",
    amber: "bg-amber-50 text-amber-600 group-hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:group-hover:bg-amber-500/25",
  };

  return (
    <Link
      href={href}
      className="tc-animate-in group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${toneClasses[tone]}`}>
          <span className="h-5 w-5">{icon}</span>
        </div>
        <IconArrowRight className="h-4 w-4 text-[var(--color-text-muted)] opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>
      <div className="mt-4">
        <div className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">{value}</div>
        <div className="mt-0.5 text-sm font-medium text-[var(--color-text-muted)]">{label}</div>
        {hint && <div className="mt-1 text-xs text-[var(--color-text-muted)]/80">{hint}</div>}
      </div>
    </Link>
  );
}
