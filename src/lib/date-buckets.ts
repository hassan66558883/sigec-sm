// Petit utilitaire partage pour les graphiques de tendance mensuelle
// (population, etat civil, recettes) — genere une serie continue de N mois
// se terminant au mois courant, meme quand certains mois n'ont aucune
// donnee (evite les trous dans les graphiques recharts).
export type MonthBucket = { date: Date; key: string; label: string };

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthBuckets(months: number, now = new Date()): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ date: d, key: monthKey(d), label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }) });
  }
  return buckets;
}
