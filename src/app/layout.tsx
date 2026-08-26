import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIGEC-SM — Ville de N'Djamena",
  description:
    "Systeme Integre de Gestion de l'Etat Civil et des Services Municipaux de la Ville de N'Djamena",
};

// lang/dir restent fixes en francais/LTR au niveau racine : seule une partie
// de l'application est traduite pour l'instant (connexion, coquille admin,
// tableau de bord — voir docs/I18N.md). Les pages metier pas encore
// traduites (citoyens, naissances, finances...) doivent rester en LTR meme
// quand l'utilisateur choisit l'arabe, sinon leur texte francais s'afficherait
// de droite a gauche. Chaque zone traduite pose donc son propre `dir` local
// (voir lib/i18n/index.ts + les layouts admin/connexion) plutot que de
// changer <html> globalement.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
