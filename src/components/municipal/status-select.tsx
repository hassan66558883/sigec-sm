"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StatusSelect({
  endpoint,
  value,
  options,
  className,
}: {
  endpoint: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onChange(newStatus: string) {
    setLoading(true);
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <select
      value={value}
      disabled={loading}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? "rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
