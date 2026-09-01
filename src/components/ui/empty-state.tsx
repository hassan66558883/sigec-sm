import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex h-full flex-col items-center justify-center text-center ${compact ? "py-6" : "py-14"}`}>
      {icon && <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-text-muted)]">{icon}</div>}
      <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-[var(--color-text-muted)]">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
