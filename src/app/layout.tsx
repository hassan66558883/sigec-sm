import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";
import { CsrfInit } from "@/components/csrf-init";

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
// (voir lib/i18n/server.ts + les layouts admin/connexion) plutot que de
// changer <html> globalement.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce");

  return (
    // suppressHydrationWarning : le script anti-flash pose data-theme sur
    // <html> AVANT l'hydratation React, qui ne peut pas le savoir depuis le
    // HTML rendu cote serveur — mismatch attendu et sans consequence sur cet
    // unique attribut (solution standard pour ce motif, pas un contournement
    // d'un vrai bug — voir next-themes et la doc React sur les scripts de
    // theme). Ne masque AUCUNE autre difference d'hydratation ailleurs dans
    // l'arbre : la prop ne s'applique qu'a cet element.
    <html lang="fr" suppressHydrationWarning>
      <body>
        {/* Applique le theme sombre AVANT l'hydratation (strategy
            beforeInteractive) pour eviter un flash du theme clair par
            defaut — bascule explicite uniquement (voir ThemeToggle),
            jamais automatique sur prefers-color-scheme. Le nonce est
            requis : la CSP de ce projet (src/proxy.ts) n'autorise aucun
            script inline sans lui — voir le correctif du 2026-09-05 qui a
            corrige exactement ce type d'oubli. */}
        <Script id="theme-init" strategy="beforeInteractive" nonce={nonce ?? undefined}>
          {`try {
            if (localStorage.getItem("sigec-theme") === "dark") {
              document.documentElement.setAttribute("data-theme", "dark");
            }
          } catch (e) {}`}
        </Script>
        <CsrfInit />
        {children}
      </body>
    </html>
  );
}
