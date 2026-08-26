import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SidebarNav } from "@/components/sidebar-nav";
import { LogoutButton } from "@/components/logout-button";
import { countUnreadNotifications } from "@/lib/services/notifications";
import { IconMapPin } from "@/components/icons";

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

  const orgLabel = user.hasGlobalScope
    ? "Mairie Centrale"
    : (
        await prisma.arrondissement.findMany({
          where: { id: { in: user.arrondissementIds } },
          select: { name: true },
        })
      )
        .map((a) => a.name)
        .join(", ") || "Aucun arrondissement";

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-[1px_0_0_0_rgb(15_23_42_/_0.03)]">
        <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-4 py-4">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
            style={{ background: "var(--gradient-primary)" }}
          >
            SM
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight tracking-tight">SIGEC-SM</div>
            <div className="text-xs leading-tight text-[var(--color-text-muted)]">
              Ville de N&apos;Djamena
            </div>
          </div>
        </div>

        <div className="border-b border-[var(--color-border)] px-4 py-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
              user.hasGlobalScope
                ? "bg-[var(--color-accent-soft)] text-[var(--color-primary-dark)] ring-[var(--color-accent)]/30"
                : "bg-gray-50 text-[var(--color-text-muted)] ring-[var(--color-border)]"
            }`}
          >
            <IconMapPin className="h-3 w-3" />
            {orgLabel}
          </span>
        </div>

        <SidebarNav visibleModules={visibleModules} />

        <div className="border-t border-[var(--color-border)] p-3">
          <div className="mb-2 flex items-center gap-2.5 px-1">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
              style={{ background: "var(--gradient-primary)" }}
            >
              {initials(user.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs text-[var(--color-text-muted)]">
                {user.roles.map((r) => r.name).join(", ") || "Aucun role"}
              </div>
            </div>
          </div>
          <Link
            href="/admin/notifications"
            className="mb-2 flex items-center justify-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-center text-sm text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary-dark)]"
          >
            Notifications
            {unreadNotifications > 0 && (
              <span className="rounded-full bg-[var(--color-danger)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {unreadNotifications}
              </span>
            )}
          </Link>
          <Link
            href="/admin/reset-password"
            className="mb-2 block rounded-md border border-[var(--color-border)] px-3 py-2 text-center text-sm text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary-dark)]"
          >
            Changer mon mot de passe
          </Link>
          <LogoutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-[var(--color-bg)]">
        <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
