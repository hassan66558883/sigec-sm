"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { chartColors } from "@/components/admin/charts/chart-colors";

export type BarTrendSeries = { key: string; label: string; color: string };

// `xKey` par defaut "month" (graphiques de tendance mensuelle) — les
// comparaisons par categorie (ex. classement des arrondissements, Phase 3)
// passent un autre champ (ex. "name"). `layout="horizontal-bars"` bascule
// en barres horizontales (recharts layout="vertical", nom trompeur) pour les
// classements avec des libelles longs.
export function BarTrendChart({
  data,
  series,
  xKey = "month",
  layout = "vertical-bars",
}: {
  data: Record<string, string | number>[];
  series: BarTrendSeries[];
  xKey?: string;
  layout?: "vertical-bars" | "horizontal-bars";
}) {
  if (layout === "horizontal-bars") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={chartColors.grid} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: chartColors.muted }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey={xKey}
            tick={{ fontSize: 11, fill: chartColors.muted }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${chartColors.grid}`, fontSize: 12 }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[0, 4, 4, 0]} maxBarSize={16} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: chartColors.muted }} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
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
