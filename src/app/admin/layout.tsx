import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarDrawerProvider, SidebarFrame } from "@/components/admin/sidebar-drawer";
import { Topbar } from "@/components/admin/topbar";
import { countUnreadNotifications } from "@/lib/services/notifications";
import { getI18n } from "@/lib/i18n/server";

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
  // depend pas du sens de lecture du contenu interne. SidebarFrame
  // applique la meme convention pour le tiroir mobile (voir
  // components/admin/sidebar-drawer.tsx).
  const isRtl = dir === "rtl";

  // Sidebar : desormais uniquement la navigation (logo + SidebarNav). Le
  // badge de perimetre, le selecteur de langue, la carte utilisateur et la
  // deconnexion vivent maintenant dans la barre superieure (Topbar) —
  // section 5/6 de la refonte premium.
  const sidebar = (
    <SidebarFrame
      dir={dir}
      locale={locale}
      isRtl={isRtl}
      className={isRtl ? "shadow-[-2px_0_24px_-4px_rgb(15_23_42_/_0.08)]" : "shadow-[2px_0_24px_-4px_rgb(15_23_42_/_0.08)]"}
    >
      <div className="flex h-full flex-col" style={{ background: "linear-gradient(180deg, #ffffff, #f6f8fc)" }}>
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md"
            style={{ background: "var(--gradient-primary)" }}
          >
            SM
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight tracking-tight text-[var(--color-text)]">SIGEC-SM</div>
            <div className="text-xs leading-tight text-[var(--color-text-muted)]">Ville de N&apos;Djamena</div>
          </div>
        </div>

        <SidebarNav visibleModules={visibleModules} dict={dict} />

        <div className="border-t border-[var(--color-border-subtle)] px-5 py-3 text-center text-[10px] text-[var(--color-text-muted)]">
          Ville de N&apos;Djamena — Republique du Tchad
        </div>
      </div>
    </SidebarFrame>
  );

  const mainContent = (
    <div className="flex min-w-0 flex-1 flex-col">
      <Topbar user={user} orgLabel={orgLabel} dict={dict} locale={locale} dir={dir} t={t} unreadNotifications={unreadNotifications} />
      <main className="min-w-0 flex-1 bg-[var(--color-bg)]">
        <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );

  return (
    <SidebarDrawerProvider>
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
    </SidebarDrawerProvider>
  );
}
