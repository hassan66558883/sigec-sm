"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { IconMenu } from "@/components/icons";

// Etat partage entre le bouton hamburger (dans Topbar) et le tiroir de
// sidebar (SidebarFrame) — les deux sont des freres non adjacents dans le
// JSX de admin/layout.tsx (le rendu de la sidebar/du contenu principal est
// deja reordonne pour le RTL, voir layout.tsx), d'ou le Context plutot
// qu'un simple useState local.
type DrawerState = { isOpen: boolean; toggle: () => void; close: () => void; open: () => void };
const SidebarDrawerContext = createContext<DrawerState | null>(null);

export function SidebarDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);
  const open = () => setIsOpen(true);
  const toggle = () => setIsOpen((v) => !v);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  return <SidebarDrawerContext.Provider value={{ isOpen, toggle, close, open }}>{children}</SidebarDrawerContext.Provider>;
}

export function useSidebarDrawer() {
  const ctx = useContext(SidebarDrawerContext);
  if (!ctx) throw new Error("useSidebarDrawer doit etre utilise a l'interieur de SidebarDrawerProvider");
  return ctx;
}

export function MobileMenuButton({ label }: { label: string }) {
  const { toggle } = useSidebarDrawer();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] lg:hidden"
    >
      <IconMenu className="h-5 w-5" />
    </button>
  );
}

// Coquille de la sidebar elle-meme : tiroir hors-champ sous le seuil `lg`
// (superpose au contenu, ferme par defaut), toujours visible et en flux
// normal au-dessus de `lg`. Le cote physique (gauche/droite) suit isRtl,
// exactement la meme convention "classes physiques calculees" que le reste
// du shell admin (pas d'inversion automatique via dir="rtl").
export function SidebarFrame({
  dir,
  locale,
  isRtl,
  className = "",
  children,
}: {
  dir: string;
  locale: string;
  isRtl: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { isOpen, close } = useSidebarDrawer();
  const sideClass = isRtl ? "right-0" : "left-0";
  const translateClosed = isRtl ? "translate-x-full" : "-translate-x-full";

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={close}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
        />
      )}
      <aside
        dir={dir}
        lang={locale}
        className={`fixed inset-y-0 ${sideClass} z-50 w-64 transform transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? "translate-x-0" : translateClosed
        } ${className}`}
      >
        {children}
      </aside>
    </>
  );
}
