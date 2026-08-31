import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SidebarNav } from "@/components/sidebar-nav";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { countUnreadNotifications } from "@/lib/services/notifications";
import { IconMapPin } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length >= 2 ? [parts[0][0], parts[1][0]] : [name.slice(0, 2)]).join("").toUpperCase();
}

const NAV_MODULES = [
  "territorial", "departments", "users", "roles", "audit",
  "citizens", "households", "births", "recognitions", "marriages", "divorces", "deaths", "certificates",
  "applications", "land", "urbanism", "businesses", "markets", "payments",
  "associations", "complaints", "infrastructure",
  "tariffs", "obligations", "collectors", "receipts",
  "caisses", "versements", "mobile_money", "fraud",
  // TECHNOTCHAD (editeur) — visible uniquement pour les roles technotchad_*,
  // jamais pour les roles municipaux (voir l'exclusion "ALL" dans
  // prisma/seed.ts, regle 23 : separation stricte commercial/municipal).
  "technotchad_clients", "technotchad_products", "technotchad_plans",
  "technotchad_subscriptions", "technotchad_licenses",
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // mustResetPwd est applique dans proxy.ts (avant meme d'atteindre ce
  // layout), y compris pour les navigations cote client — voir proxy.ts.

  const visibleModules = new Set(NAV_MODULES.filter((m) => user.permissions.has(`${m}:view`)));

  const unreadNotifications = await countUnreadNotifications(user);
  const { locale, dir, dict, t } = await getI18n();

  const orgLabel = user.hasGlobalScope
    ? t("sidebar.centralCityHall")
    : (
        await prisma.arrondissement.findMany({
          where: { id: { in: user.arrondissementIds } },
          select: { name: true },
        })
      )
        .map((a) => a.name)
        .join(", ") || t("sidebar.noArrondissementAssigned");

  // Cote physique de la sidebar : a gauche en francais (comme avant), a
  // droite en arabe — la convention RTL habituelle (menu du cote "depart"
  // de la lecture, donc a droite en arabe). Realise par simple
  // reordonnancement du DOM (aside en premier ou en second) a l'interieur
  // d'un conteneur dir="ltr" fixe, plutot qu'en s'appuyant sur le
  // retournement flex d'un dir="rtl" global — plus simple a prevoir et ne
  // depend pas du sens de lecture du contenu interne.
  const isRtl = dir === "rtl";

  const sidebar = (
    <aside
      dir={dir}
      lang={locale}
      className={`flex w-64 flex-col text-white ${isRtl ? "shadow-[-4px_0_16px_0_rgb(0_0_0_/_0.15)]" : "shadow-[4px_0_16px_0_rgb(0_0_0_/_0.15)]"}`}
      style={{ background: "linear-gradient(180deg, var(--color-primary-dark), #072544)" }}
    >
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white shadow-sm ring-1 ring-white/20"
          >
            SM
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight tracking-tight text-white">SIGEC-SM</div>
            <div className="text-xs leading-tight text-white/55">
              Ville de N&apos;Djamena
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
              user.hasGlobalScope
                ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-[var(--color-accent)]/30"
                : "bg-white/10 text-white/70 ring-white/15"
            }`}
          >
            <IconMapPin className="h-3 w-3" />
            {orgLabel}
          </span>
          <LanguageSwitcher locale={locale} variant="onDark" />
        </div>

        <SidebarNav visibleModules={visibleModules} dict={dict} />

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-2.5 px-1">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white shadow-sm ring-1 ring-white/20"
            >
              {initials(user.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{user.name}</div>
              <div className="truncate text-xs text-white/55">
                {user.roles.map((r) => r.name).join(", ") || t("sidebar.noRole")}
              </div>
            </div>
          </div>
          <Link
            href="/admin/notifications"
            className="mb-2 flex items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-2 text-center text-sm text-white/75 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            {t("sidebar.notifications")}
            {unreadNotifications > 0 && (
              <span className="rounded-full bg-[var(--color-danger)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {unreadNotifications}
              </span>
            )}
          </Link>
          <Link
            href="/admin/reset-password"
            className="mb-2 block rounded-md border border-white/15 px-3 py-2 text-center text-sm text-white/75 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            {t("sidebar.changePassword")}
          </Link>
          <LogoutButton label={t("sidebar.logout")} variant="onDark" />
        </div>
      </aside>
  );

  const mainContent = (
    <main className="min-w-0 flex-1 bg-[var(--color-bg)]">
      <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
    </main>
  );

  return (
    <div dir="ltr" className="flex min-h-screen">
      {isRtl ? (
        <>
          {mainContent}
          {sidebar}
        </>
      ) : (
        <>
          {sidebar}
          {mainContent}
        </>
      )}
    </div>
  );
}
