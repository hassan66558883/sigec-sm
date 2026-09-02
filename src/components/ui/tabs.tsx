"use client";

import { useState, type ReactNode } from "react";

export type TabItem = { id: string; label: string; content: ReactNode };

// Le contenu de chaque onglet est deja rendu cote serveur (ReactNode) au
// moment ou il est passe en prop ici — un Client Component peut recevoir du
// JSX deja resolu depuis un parent serveur (contrairement a une fonction),
// donc aucun fetch supplementaire ni frontiere RSC violee.
export function Tabs({ tabs, defaultTab }: { tabs: TabItem[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              active === t.id
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-5">{activeTab?.content}</div>
    </div>
  );
}
