"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS: { title: string | null; items: { href: string; label: string; exact?: boolean; module: string | null }[] }[] = [
  {
    title: null,
    items: [
      { href: "/admin", label: "Tableau de bord", exact: true, module: null },
      { href: "/admin/analytics", label: "Statistiques", module: null },
    ],
  },
  {
    title: "Etat civil",
    items: [
      { href: "/admin/citizens", label: "Citoyens", module: "citizens" },
      { href: "/admin/households", label: "Menages", module: "households" },
      { href: "/admin/births", label: "Naissances", module: "births" },
      { href: "/admin/recognitions", label: "Reconnaissances", module: "recognitions" },
      { href: "/admin/marriages", label: "Mariages", module: "marriages" },
      { href: "/admin/divorces", label: "Divorces", module: "divorces" },
      { href: "/admin/deaths", label: "Deces", module: "deaths" },
      { href: "/admin/certificates", label: "Certificats", module: "certificates" },
      { href: "/admin/applications", label: "Demandes citoyennes", module: "applications" },
    ],
  },
  {
    title: "Foncier et urbanisme",
    items: [
      { href: "/admin/land", label: "Parcelles & titres", module: "land" },
      { href: "/admin/urbanism", label: "Permis & autorisations", module: "urbanism" },
    ],
  },
  {
    title: "Recettes municipales",
    items: [
      { href: "/admin/finances", label: "Tableau de bord recettes", module: "payments" },
      { href: "/admin/citizens", label: "Contribuables", module: "citizens" },
      { href: "/admin/activities", label: "Activites economiques", module: "tariffs" },
      { href: "/admin/businesses", label: "Boutiques & commercants", module: "businesses" },
      { href: "/admin/markets", label: "Marches & emplacements", module: "markets" },
      { href: "/admin/tariffs", label: "Tarification", module: "tariffs" },
      { href: "/admin/obligations", label: "Obligations", module: "obligations" },
      { href: "/admin/collectors", label: "Agents collecteurs", module: "collectors" },
      { href: "/admin/collecte", label: "Collecte (terrain)", module: "payments" },
      { href: "/admin/payments", label: "Paiements", module: "payments" },
      { href: "/admin/mobile-money", label: "Mobile Money", module: "mobile_money" },
      { href: "/admin/receipts", label: "Recus", module: "receipts" },
      { href: "/admin/caisses", label: "Caisses", module: "caisses" },
      { href: "/admin/versements", label: "Versements", module: "versements" },
      { href: "/admin/fraud", label: "Controle anti-fraude", module: "fraud" },
      { href: "/admin/reports", label: "Rapports", module: "payments" },
    ],
  },
  {
    title: "Services municipaux",
    items: [
      { href: "/admin/associations", label: "Associations & ONG", module: "associations" },
      { href: "/admin/complaints", label: "Plaintes & doleances", module: "complaints" },
      { href: "/admin/infrastructure", label: "Voirie & infrastructures", module: "infrastructure" },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/admin/arrondissements", label: "Arrondissements & quartiers", module: "territorial" },
      { href: "/admin/departments", label: "Services centraux", module: "departments" },
      { href: "/admin/users", label: "Utilisateurs", module: "users" },
      { href: "/admin/roles", label: "Roles & permissions", module: "roles" },
      { href: "/admin/audit", label: "Journal d'audit", module: "audit" },
    ],
  },
];

export function SidebarNav({ visibleModules }: { visibleModules: Set<string> }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((item) => item.module === null || visibleModules.has(item.module));
        if (items.length === 0) return null;
        return (
          <div key={section.title ?? "top"}>
            {section.title && (
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {section.title}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-1.5 text-sm transition ${
                      active ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text)] hover:bg-gray-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
