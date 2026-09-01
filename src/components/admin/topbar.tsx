import { IconMapPin } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MobileMenuButton } from "@/components/admin/sidebar-drawer";
import { GlobalSearch } from "@/components/admin/global-search";
import { NotificationBell } from "@/components/admin/notification-bell";
import { UserMenu } from "@/components/admin/user-menu";
import type { Dictionary, Locale, TranslationKey } from "@/lib/i18n/translate";
import type { CurrentUser } from "@/lib/auth";

// Barre superieure du shell admin (sections 6/25/30) : compose uniquement
// des donnees deja recuperees par admin/layout.tsx (user, orgLabel, dict,
// unreadNotifications) — aucun fetch supplementaire a ce niveau. Les
// elements qui vivaient auparavant dans le pied de la sidebar (badge de
// perimetre, selecteur de langue, carte utilisateur, deconnexion) sont
// deplaces ici ; la sidebar redevient purement une navigation.
export function Topbar({
  user,
  orgLabel,
  dict,
  locale,
  dir,
  t,
  unreadNotifications,
}: {
  user: CurrentUser;
  orgLabel: string;
  dict: Dictionary;
  locale: Locale;
  dir: string;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  unreadNotifications: number;
}) {
  return (
    <header
      dir={dir}
      lang={locale}
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]/95 px-4 py-3 backdrop-blur-sm sm:px-6"
    >
      <MobileMenuButton label={t("topbar.toggleMenu")} />

      <span
        className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset md:inline-flex ${
          user.hasGlobalScope
            ? "bg-[var(--color-accent-soft)] text-[var(--color-primary-dark)] ring-[var(--color-accent)]/30"
            : "bg-[var(--color-surface)] text-[var(--color-text-muted)] ring-[var(--color-border)]"
        }`}
      >
        <IconMapPin className="h-3 w-3" />
        {orgLabel}
      </span>

      <div className="min-w-0 flex-1">
        <GlobalSearch dict={dict} />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <NotificationBell dict={dict} initialUnread={unreadNotifications} />
        <LanguageSwitcher locale={locale} />
        <div className="mx-1 hidden h-6 w-px bg-[var(--color-border)] sm:block" />
        <UserMenu
          name={user.name}
          roleLabel={user.roles.map((r) => r.name).join(", ") || t("sidebar.noRole")}
          changePasswordLabel={t("sidebar.changePassword")}
          logoutLabel={t("sidebar.logout")}
        />
      </div>
    </header>
  );
}
