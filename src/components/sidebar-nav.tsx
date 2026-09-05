"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconUsersGroup, IconMapPin, IconCoins, IconBuildingOffice, IconShieldCheck, IconPlug } from "@/components/icons";
import { makeT, type Dictionary, type TranslationKey } from "@/lib/i18n/translate";

const NAV_SECTIONS: {
  titleKey: TranslationKey | null;
  icon?: ReactNode;
  accent?: boolean;
  items: { href: string; labelKey: TranslationKey; exact?: boolean; module: string | null }[];
}[] = [
  {
    titleKey: null,
    items: [
      { href: "/admin", labelKey: "sidebar.dashboard", exact: true, module: null },
      { href: "/admin/analytics", labelKey: "sidebar.statistics", module: null },
    ],
  },
  {
    titleKey: "sidebar.sectionCivilStatus",
    icon: <IconUsersGroup className="h-3.5 w-3.5" />,
    items: [
      { href: "/admin/citizens", labelKey: "sidebar.citizens", module: "citizens" },
      { href: "/admin/households", labelKey: "sidebar.households", module: "households" },
      { href: "/admin/births", labelKey: "sidebar.births", module: "births" },
      { href: "/admin/recognitions", labelKey: "sidebar.recognitions", module: "recognitions" },
      { href: "/admin/marriages", labelKey: "sidebar.marriages", module: "marriages" },
      { href: "/admin/divorces", labelKey: "sidebar.divorces", module: "divorces" },
      { href: "/admin/deaths", labelKey: "sidebar.deaths", module: "deaths" },
      { href: "/admin/certificates", labelKey: "sidebar.certificates", module: "certificates" },
      { href: "/admin/applications", labelKey: "sidebar.applications", module: "applications" },
    ],
  },
  {
    titleKey: "sidebar.sectionLand",
    icon: <IconMapPin className="h-3.5 w-3.5" />,
    items: [
      { href: "/admin/land", labelKey: "sidebar.land", module: "land" },
      { href: "/admin/urbanism", labelKey: "sidebar.urbanism", module: "urbanism" },
    ],
  },
  {
    titleKey: "sidebar.sectionRevenue",
    icon: <IconCoins className="h-3.5 w-3.5" />,
    items: [
      { href: "/admin/finances", labelKey: "sidebar.financeDashboard", module: "payments" },
      { href: "/admin/citizens", labelKey: "sidebar.taxpayers", module: "citizens" },
      { href: "/admin/activities", labelKey: "sidebar.activities", module: "tariffs" },
      { href: "/admin/businesses", labelKey: "sidebar.businesses", module: "businesses" },
      { href: "/admin/markets", labelKey: "sidebar.markets", module: "markets" },
      { href: "/admin/tariffs", labelKey: "sidebar.tariffs", module: "tariffs" },
      { href: "/admin/obligations", labelKey: "sidebar.obligations", module: "obligations" },
      { href: "/admin/collectors", labelKey: "sidebar.collectors", module: "collectors" },
      { href: "/admin/collecte", labelKey: "sidebar.fieldCollection", module: "payments" },
      { href: "/admin/payments", labelKey: "sidebar.payments", module: "payments" },
      { href: "/admin/mobile-money", labelKey: "sidebar.mobileMoney", module: "mobile_money" },
      { href: "/admin/receipts", labelKey: "sidebar.receipts", module: "receipts" },
      { href: "/admin/caisses", labelKey: "sidebar.caisses", module: "caisses" },
      { href: "/admin/versements", labelKey: "sidebar.versements", module: "versements" },
      { href: "/admin/reconciliation", labelKey: "sidebar.reconciliation", module: "reconciliation" },
      { href: "/admin/fraud", labelKey: "sidebar.fraud", module: "fraud" },
      { href: "/admin/reports", labelKey: "sidebar.reports", module: "payments" },
    ],
  },
  {
    titleKey: "sidebar.sectionServices",
    icon: <IconBuildingOffice className="h-3.5 w-3.5" />,
    items: [
      { href: "/admin/associations", labelKey: "sidebar.associations", module: "associations" },
      { href: "/admin/complaints", labelKey: "sidebar.complaints", module: "complaints" },
      { href: "/admin/infrastructure", labelKey: "sidebar.infrastructure", module: "infrastructure" },
    ],
  },
  {
    titleKey: "sidebar.sectionAdmin",
    icon: <IconShieldCheck className="h-3.5 w-3.5" />,
    items: [
      { href: "/admin/arrondissements", labelKey: "sidebar.arrondissements", module: "territorial" },
      { href: "/admin/departments", labelKey: "sidebar.departments", module: "departments" },
      { href: "/admin/users", labelKey: "sidebar.users", module: "users" },
      { href: "/admin/roles", labelKey: "sidebar.roles", module: "roles" },
      { href: "/admin/audit", labelKey: "sidebar.audit", module: "audit" },
    ],
  },
  {
    titleKey: "sidebar.sectionIntegration",
    icon: <IconPlug className="h-3.5 w-3.5" />,
    items: [
      { href: "/admin/integration", labelKey: "sidebar.integrationDashboard", exact: true, module: "integration" },
      { href: "/admin/integration/systems", labelKey: "sidebar.integrationSystems", module: "integration" },
      { href: "/admin/integration/webhooks", labelKey: "sidebar.integrationWebhooks", module: "integration" },
      { href: "/admin/integration/api-keys", labelKey: "sidebar.integrationApiKeys", module: "integration" },
      { href: "/admin/integration/logs", labelKey: "sidebar.integrationLogs", module: "integration" },
      { href: "/admin/integration/errors", labelKey: "sidebar.integrationErrors", module: "integration" },
      { href: "/admin/integration/documentation", labelKey: "sidebar.integrationDocumentation", module: "integration" },
      { href: "/admin/integration/api-tester", labelKey: "sidebar.integrationApiTester", module: "integration" },
    ],
  },
  {
    titleKey: null,
    accent: true,
    items: [
      { href: "/admin/technotchad", labelKey: "sidebar.technotchadDashboard", exact: true, module: "technotchad_clients" },
      { href: "/admin/technotchad/clients", labelKey: "sidebar.technotchadClients", module: "technotchad_clients" },
      { href: "/admin/technotchad/subscriptions", labelKey: "sidebar.technotchadSubscriptions", module: "technotchad_subscriptions" },
      { href: "/admin/technotchad/licenses", labelKey: "sidebar.technotchadLicenses", module: "technotchad_licenses" },
    ],
  },
];

const TECHNOTCHAD_TITLE = "TECHNOTCHAD";

export function SidebarNav({ visibleModules, dict }: { visibleModules: Set<string>; dict: Dictionary }) {
  const pathname = usePathname();
  const t = makeT(dict);

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3">
      {NAV_SECTIONS.map((section, index) => {
        const items = section.items.filter((item) => item.module === null || visibleModules.has(item.module));
        if (items.length === 0) return null;
        const title = section.accent ? TECHNOTCHAD_TITLE : section.titleKey ? t(section.titleKey) : null;
        return (
          <div key={section.titleKey ?? `top-${index}`} className={section.accent ? "mt-1 border-t border-[var(--color-border)] pt-4" : undefined}>
            {title && (
              <div className="mb-1.5 flex items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {section.accent ? (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "linear-gradient(135deg, #4338ca, #8b5cf6)" }}
                  />
                ) : (
                  section.icon && <span className="text-[var(--color-primary)]/60">{section.icon}</span>
                )}
                {title}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      active
                        ? "font-medium text-white shadow-md"
                        : "text-[var(--color-text)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary-dark)]"
                    }`}
                    style={
                      active
                        ? { background: section.accent ? "linear-gradient(120deg, #4338ca, #6366f1)" : "var(--gradient-primary)" }
                        : undefined
                    }
                  >
                    {t(item.labelKey)}
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
