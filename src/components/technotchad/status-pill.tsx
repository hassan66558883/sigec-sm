const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  GENERATED: "bg-sky-50 text-sky-700 ring-sky-600/20",
  DRAFT: "bg-gray-100 text-gray-600 ring-gray-500/20",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  PAYMENT_DUE: "bg-amber-50 text-amber-700 ring-amber-600/20",
  OVERDUE: "bg-orange-50 text-orange-700 ring-orange-600/20",
  GRACE_PERIOD: "bg-orange-50 text-orange-700 ring-orange-600/20",
  SUSPENDED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  EXPIRED: "bg-gray-100 text-gray-500 ring-gray-500/20",
  CANCELLED: "bg-gray-100 text-gray-500 ring-gray-500/20",
  TERMINATED: "bg-gray-100 text-gray-500 ring-gray-500/20",
  REVOKED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  INACTIVE: "bg-gray-100 text-gray-500 ring-gray-500/20",
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
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600 ring-gray-500/20";
  const dot = DOT_STYLES[status] ?? "bg-gray-400";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}
