export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-rose-50 text-rose-700 ring-rose-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  neutral: "bg-gray-100 text-gray-600 ring-gray-500/20",
  primary: "bg-[var(--color-primary-light)] text-[var(--color-primary)] ring-[var(--color-primary)]/20",
};

const DOT_CLASSES: Record<StatusTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  neutral: "bg-gray-400",
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
