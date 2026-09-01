"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { chartColors } from "@/components/admin/charts/chart-colors";

export type BarTrendSeries = { key: string; label: string; color: string };

export function BarTrendChart({ data, series }: { data: Record<string, string | number>[]; series: BarTrendSeries[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: chartColors.muted }} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: chartColors.muted }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${chartColors.grid}`, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={18} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
