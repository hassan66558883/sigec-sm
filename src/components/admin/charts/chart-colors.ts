// Recharts fixe stroke/fill comme attributs SVG bruts (pas de resolution
// var(--...) comme le ferait un style CSS inline) — ces valeurs doivent donc
// dupliquer les jetons de src/app/globals.css. A garder synchronise si la
// palette change.
export const chartColors = {
  primary: "#0f4c81",
  primaryLight: "#5b8fc4",
  accent: "#c8a13a",
  success: "#1e7d4b",
  warning: "#b8860b",
  danger: "#b3261e",
  muted: "#5b6b7d",
  grid: "#e3e8ef",
};
