export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-[var(--color-success)]/10 text-[var(--color-success)] ring-[var(--color-success)]/25",
  warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning-text)] ring-[var(--color-warning)]/30",
  danger: "bg-[var(--color-danger)]/10 text-[var(--color-danger)] ring-[var(--color-danger)]/25",
  info: "bg-[var(--color-info-soft)] text-[var(--color-info)] ring-[var(--color-info)]/20",
  neutral: "bg-[var(--color-neutral-soft)] text-[var(--color-neutral-text)] ring-[var(--color-text-muted)]/20",
  primary: "bg-[var(--color-primary-light)] text-[var(--color-primary)] ring-[var(--color-primary)]/20",
};

const DOT_CLASSES: Record<StatusTone, string> = {
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]",
  info: "bg-[var(--color-info)]",
  neutral: "bg-[var(--color-text-muted)]",
  primary: "bg-[var(--color-primary)]",
};

// Badge de statut unique, utilise a terme (Phase 2+) par toutes les listes
// de l'application, en remplacement des maps Record<string,string> locales
// redefinies sur chaque page aujourd'hui.
export function StatusBadge({ label, tone = "neutral", dot = true }: { label: string; tone?: StatusTone; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]}`} />}
      {label}
    </span>
  );
}
