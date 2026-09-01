import { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";

// Miroir SQL brut de recordScopeWhere() (src/lib/rbac.ts) — necessaire
// uniquement pour les requetes $queryRaw (agregations par mois via
// date_trunc, que Prisma.groupBy ne sait pas exprimer). Doit rester
// strictement equivalent a recordScopeWhere ; ne remplace ni ne modifie ce
// dernier, qui reste la source de verite pour toutes les requetes Prisma
// normales.
export function scopeSql(user: CurrentUser | null, column = "arrondissementId") {
  const col = Prisma.raw(`"${column}"`);
  if (!user) return Prisma.sql`FALSE`;
  if (user.hasGlobalScope) return Prisma.sql`TRUE`;
  if (user.arrondissementIds.length === 0) return Prisma.sql`FALSE`;
  return Prisma.sql`${col} = ANY(${user.arrondissementIds})`;
}
