import type { CurrentUser } from "@/lib/auth";

export function can(user: CurrentUser | null, module: string, action: string): boolean {
  if (!user) return false;
  return user.permissions.has(`${module}:${action}`);
}

export function requirePermission(user: CurrentUser | null, module: string, action: string) {
  if (!can(user, module, action)) {
    throw new ForbiddenError(`Permission manquante: ${module}:${action}`);
  }
}

export class ForbiddenError extends Error {
  status = 403;
}

// Isolation par arrondissement (section 19). Renvoie true si l'utilisateur
// peut acceder aux donnees rattachees a cet arrondissement.
export function canAccessArrondissement(user: CurrentUser | null, arrondissementId: string): boolean {
  if (!user) return false;
  if (user.hasGlobalScope) return true;
  return user.arrondissementIds.includes(arrondissementId);
}

export function canAccessQuartier(
  user: CurrentUser | null,
  quartierId: string,
  quartierArrondissementId: string,
): boolean {
  if (!user) return false;
  if (user.hasGlobalScope) return true;
  // Si l'utilisateur a des restrictions par quartier, elles priment ;
  // sinon l'acces suit simplement l'arrondissement autorise.
  if (user.quartierIds.length > 0) return user.quartierIds.includes(quartierId);
  return user.arrondissementIds.includes(quartierArrondissementId);
}

// Pour les requetes de liste sur la table Arrondissement elle-meme :
// predicat Prisma "where" limitant aux arrondissements autorises, ou {}
// (aucune restriction) en portee globale (Mairie Centrale).
export function arrondissementScopeWhere(user: CurrentUser | null) {
  if (!user) return { id: "__none__" };
  if (user.hasGlobalScope) return {};
  return { id: { in: user.arrondissementIds } };
}

// Convention a reutiliser par TOUS les modules operationnels futurs (etat
// civil, recettes/taxes, marches, plaintes, foncier, urbanisme, voirie,
// associations, statistiques...) : chaque table de donnees "de terrain" doit
// porter un champ arrondissementId (nullable = collecte/enregistre par la
// Mairie Centrale, jamais par un arrondissement) et son service doit filtrer
// via ce helper cote serveur (jamais seulement masquer un menu cote client).
//
//   MAIRIE CENTRALE (organizationLevel=CENTRAL) -> aucune restriction : voit
//     les 10 arrondissements + les enregistrements centraux (arrondissementId
//     = null) et peut calculer les totaux consolides par simple agregation.
//   ARRONDISSEMENT -> uniquement les enregistrements dont arrondissementId
//     est dans son perimetre (jamais les enregistrements centraux).
//
// Exemple (Phase 5, Finances/Taxes) :
//   prisma.payment.findMany({ where: recordScopeWhere(user) })
//   prisma.payment.groupBy({ by: ["arrondissementId"], where: recordScopeWhere(user), _sum: { amount: true } })
export function recordScopeWhere(user: CurrentUser | null, field = "arrondissementId") {
  if (!user) return { [field]: "__none__" };
  if (user.hasGlobalScope) return {};
  return { [field]: { in: user.arrondissementIds } };
}
