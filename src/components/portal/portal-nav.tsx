"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/portail", label: "Tableau de bord" },
  { href: "/portail/factures", label: "Mes factures" },
  { href: "/portail/paiements", label: "Mes paiements" },
  { href: "/portail/demandes/nouvelle", label: "Nouvelle demande" },
  { href: "/portail/plaintes", label: "Mes plaintes" },
  { href: "/portail/voirie", label: "Signaler (voirie)" },
  { href: "/portail/mot-de-passe", label: "Mon mot de passe" },
];

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/portail" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              active ? "text-white shadow-sm" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
            }`}
            style={active ? { background: "var(--gradient-primary)" } : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
