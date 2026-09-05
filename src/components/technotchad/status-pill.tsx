const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25",
  GENERATED: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/25",
  DRAFT: "bg-gray-100 text-gray-600 ring-gray-500/20 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25",
  PAYMENT_DUE: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25",
  OVERDUE: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/25",
  GRACE_PERIOD: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/25",
  SUSPENDED: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/25",
  EXPIRED: "bg-gray-100 text-gray-500 ring-gray-500/20 dark:bg-white/10 dark:text-slate-400 dark:ring-white/15",
  CANCELLED: "bg-gray-100 text-gray-500 ring-gray-500/20 dark:bg-white/10 dark:text-slate-400 dark:ring-white/15",
  TERMINATED: "bg-gray-100 text-gray-500 ring-gray-500/20 dark:bg-white/10 dark:text-slate-400 dark:ring-white/15",
  REVOKED: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/25",
  INACTIVE: "bg-gray-100 text-gray-500 ring-gray-500/20 dark:bg-white/10 dark:text-slate-400 dark:ring-white/15",
};

const DOT_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500",
  GENERATED: "bg-sky-500",
  DRAFT: "bg-gray-400",
  PENDING: "bg-amber-500",
  PAYMENT_DUE: "bg-amber-500",
  OVERDUE: "bg-orange-500",
  GRACE_PERIOD: "bg-orange-500",
  SUSPENDED: "bg-rose-500",
  EXPIRED: "bg-gray-400",
  CANCELLED: "bg-gray-400",
  TERMINATED: "bg-gray-400",
  REVOKED: "bg-rose-500",
  INACTIVE: "bg-gray-400",
};

export function TechnoStatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600 ring-gray-500/20 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15";
  const dot = DOT_STYLES[status] ?? "bg-gray-400";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}
