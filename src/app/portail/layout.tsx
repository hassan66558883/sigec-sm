import Link from "next/link";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { CitizenLogoutButton } from "@/components/portal/citizen-logout-button";
import { PortalNav } from "@/components/portal/portal-nav";

export default async function PortailLayout({ children }: { children: React.ReactNode }) {
  const account = await getCurrentCitizenAccount();

  if (!account) {
    // /portail/login et /portail/register (seules pages accessibles sans
    // session citoyen, cf. proxy.ts) gerent leur propre mise en page.
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/portail" className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-white shadow-md"
              style={{ background: "var(--gradient-primary)" }}
            >
              SM
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight text-[var(--color-text)]">SIGEC-SM</div>
              <div className="text-xs leading-tight text-[var(--color-text-muted)]">Espace citoyen</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[var(--color-text-muted)] sm:block">
              {account.citizen.firstName} {account.citizen.lastName}
            </span>
            <CitizenLogoutButton />
          </div>
        </div>
        <PortalNav />
      </header>
      <main className="mx-auto max-w-4xl p-6 sm:p-8">{children}</main>
    </div>
  );
}
