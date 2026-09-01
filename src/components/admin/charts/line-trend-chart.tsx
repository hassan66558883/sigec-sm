"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { chartColors } from "@/components/admin/charts/chart-colors";

export type LineTrendSeries = { key: string; label: string; color: string };
export type ValueFormat = "number" | "thousandsFcfa";

// Un composant client ne peut pas recevoir de fonction en prop depuis un
// composant serveur (non serialisable a travers la frontiere RSC) — le
// formatage est donc pilote par un identifiant de format simple, pas un
// callback.
function formatValue(value: number, format?: ValueFormat) {
  if (format === "thousandsFcfa") return `${Math.round(value / 1000).toLocaleString("fr-FR")}k`;
  return value.toLocaleString("fr-FR");
}

// Composant client volontairement minimal : ne recoit que des donnees deja
// agregees cote serveur (voir getPopulationTrend/getRevenueTrend), ne fait
// aucun fetch lui-meme.
export function LineTrendChart({
  data,
  series,
  valueFormat,
}: {
  data: Record<string, string | number>[];
  series: LineTrendSeries[];
  valueFormat?: ValueFormat;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: chartColors.muted }} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: chartColors.muted }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v: number) => formatValue(v, valueFormat)}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: `1px solid ${chartColors.grid}`, fontSize: 12 }}
          formatter={(value, name) => [typeof value === "number" ? formatValue(value, valueFormat) : value, name]}
        />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
