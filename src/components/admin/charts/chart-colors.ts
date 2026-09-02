// Recharts fixe stroke/fill comme attributs SVG bruts (pas de resolution
// var(--...) comme le ferait un style CSS inline) — ces valeurs doivent donc
// dupliquer les jetons de src/app/globals.css. A garder synchronise si la
// palette change.
export const chartColors = {
  primary: "#1c83c5",
  primaryLight: "#5ab4e0",
  accent: "#f2a900",
  success: "#2e9d68",
  warning: "#f2a900",
  danger: "#d9534f",
  muted: "#607d8b",
  grid: "#dce6eb",
};
