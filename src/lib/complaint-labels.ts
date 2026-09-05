// Libelles francais des statuts du workflow Plaintes & Doleances (13
// etats). Vivait auparavant dans components/municipal/complaint-actions.tsx
// (un fichier "use client") et etait importe tel quel par plusieurs Server
// Components et une Route Handler — ce qui ne resolvait PAS correctement
// a l'execution : le statut brut (ex. "SUBMITTED") s'affichait partout au
// lieu du libelle (trouve en verifiant en live le rendu HTML reel, pas en
// supposant). Deplace ici (aucun import Node, aucune directive "use
// client") pour etre importable sans risque depuis n'importe quel contexte
// — serveur, route API, ou composant client.
export const COMPLAINT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumis",
  RECEIVED: "Recu",
  VERIFYING: "En verification",
  NEEDS_INFO: "A completer",
  ASSIGNED_DEPT: "Affecte",
  ASSIGNED_AGENT: "Assigne",
  IN_PROGRESS: "En cours",
  WAITING: "En attente",
  RESOLVED: "Resolu",
  VALIDATING: "En validation",
  CLOSED: "Cloture",
  REJECTED: "Rejete",
};
