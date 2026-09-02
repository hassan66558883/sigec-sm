"use client";

import { useState, type ReactNode } from "react";
import { IconChevronDown } from "@/components/icons";

// Panneau de recherche repliable, pattern "Advanced Search" (inspire d'une
// reference HMIS partagee par l'utilisateur) — le contenu (formulaire GET
// existant de la page) est passe en enfant, ce composant ne gere que
// l'ouverture/fermeture, aucune logique de recherche propre.
export function AdvancedSearchPanel({
  title = "Recherche avancee",
  action,
  defaultOpen = true,
  children,
}: {
  title?: string;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
          <IconChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
          {title}
        </button>
        {action}
      </div>
      {open && <div className="border-t border-[var(--color-border-subtle)] p-5">{children}</div>}
    </div>
  );
}
