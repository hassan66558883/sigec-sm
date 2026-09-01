// Petit utilitaire partage pour les graphiques de tendance mensuelle
// (population, etat civil, recettes) — genere une serie continue de N mois
// se terminant au mois courant, meme quand certains mois n'ont aucune
// donnee (evite les trous dans les graphiques recharts).
export type MonthBucket = { date: Date; key: string; label: string };

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Bornes jour/semaine (lundi)/mois/annee, recalculees a partir de l'heure
// serveur actuelle — meme convention que getFinanceSummary
// (src/lib/services/payments.ts), reutilisee par les en-tetes KPI
// "aujourd'hui / cette semaine / ce mois / cette annee" des modules d'etat
// civil (Phase 2).
export function periodBounds(now = new Date()) {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = (now.getDay() + 6) % 7; // 0 = lundi
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  return { startOfDay, startOfWeek, startOfMonth, startOfYear };
}

export function monthBuckets(months: number, now = new Date()): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ date: d, key: monthKey(d), label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }) });
  }
  return buckets;
}
