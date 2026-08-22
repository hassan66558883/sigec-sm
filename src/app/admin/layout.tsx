import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SidebarNav } from "@/components/sidebar-nav";
import { LogoutButton } from "@/components/logout-button";
import { countUnreadNotifications } from "@/lib/services/notifications";

const NAV_MODULES = [
  "territorial", "departments", "users", "roles", "audit",
  "citizens", "households", "births", "recognitions", "marriages", "divorces", "deaths", "certificates",
  "applications", "land", "urbanism", "businesses", "markets", "payments",
  "associations", "complaints", "infrastructure",
  "tariffs", "obligations", "collectors", "receipts",
  "caisses", "versements", "mobile_money", "fraud",
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
      <aside className="flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-4">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: "var(--color-primary)" }}
          >
            SM
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">SIGEC-SM</div>
            <div className="text-xs leading-tight text-[var(--color-text-muted)]">
              Ville de N&apos;Djamena
            </div>
          </div>
        </div>

        <div className="border-b border-[var(--color-border)] px-4 py-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              user.hasGlobalScope
                ? "bg-[var(--color-accent)]/20 text-[var(--color-primary-dark)]"
                : "bg-gray-100 text-[var(--color-text-muted)]"
            }`}
          >
            {orgLabel}
          </span>
        </div>

        <SidebarNav visibleModules={visibleModules} />

        <div className="border-t border-[var(--color-border)] p-3">
          <div className="mb-2 px-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-[var(--color-text-muted)]">
              {user.roles.map((r) => r.name).join(", ") || "Aucun role"}
            </div>
          </div>
          <Link
            href="/admin/notifications"
            className="mb-2 flex items-center justify-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-center text-sm text-[var(--color-text-muted)] transition hover:bg-gray-50"
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
            className="mb-2 block rounded-md border border-[var(--color-border)] px-3 py-2 text-center text-sm text-[var(--color-text-muted)] transition hover:bg-gray-50"
          >
            Changer mon mot de passe
          </Link>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 bg-[var(--color-bg)]">
        <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
