"use client";

import { IconSun, IconMoon } from "@/components/icons";

// Bascule clair/sombre explicite (jamais automatique sur prefers-color-scheme
// — voir le script anti-flash dans layout.tsx pour la lecture initiale).
// Persiste dans localStorage, applique en posant/retirant l'attribut
// data-theme sur <html> — toutes les couleurs de l'app suivent via les
// jetons CSS (globals.css), aucun rechargement de page necessaire.
//
// Aucun etat React pour savoir quelle icone afficher : lire l'attribut DOM
// dans un effet puis le recopier en state provoquerait un rendu en cascade
// (regle react-hooks/set-state-in-effect) et un flash d'icone incorrecte
// avant hydratation. Le CSS (globals.css, selecteur [data-theme="dark"])
// choisit directement quelle icone est visible — le clic lit/ecrit
// l'attribut DOM directement, sans jamais passer par un state React.
const STORAGE_KEY = "sigec-theme";

export function ThemeToggle({ variant = "onDark" }: { variant?: "light" | "onDark" }) {
  function toggle() {
    const next = document.documentElement.getAttribute("data-theme") !== "dark";
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // localStorage indisponible (navigation privee...) — la preference ne
      // survit pas au rechargement, sans gravite pour la session en cours.
    }
  }

  const trackClass =
    variant === "onDark"
      ? "border-white/25 bg-white/10"
      : "border-[var(--color-border)] bg-[var(--color-bg-subtle)]";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Changer de theme (clair/sombre)"
      title="Changer de theme"
      className={`theme-toggle relative flex h-7 w-[3.25rem] shrink-0 items-center rounded-full border backdrop-blur-sm transition ${trackClass}`}
    >
      <span
        className="theme-toggle-thumb absolute flex h-5 w-5 items-center justify-center rounded-full shadow-sm transition-transform"
        style={{ background: variant === "onDark" ? "#ffffff" : "var(--color-surface)" }}
      >
        <IconSun className="theme-toggle-sun h-3 w-3 text-[var(--color-accent)]" />
        <IconMoon className="theme-toggle-moon h-3 w-3 text-[var(--color-primary-dark)]" />
      </span>
    </button>
  );
}
