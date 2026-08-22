import Link from "next/link";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { CitizenLogoutButton } from "@/components/portal/citizen-logout-button";

const NAV_ITEMS = [
  { href: "/portail", label: "Tableau de bord" },
  { href: "/portail/demandes/nouvelle", label: "Nouvelle demande" },
  { href: "/portail/plaintes", label: "Mes plaintes" },
  { href: "/portail/voirie", label: "Signaler (voirie)" },
];

export default async function PortailLayout({ children }: { children: React.ReactNode }) {
  const account = await getCurrentCitizenAccount();

  if (!account) {
    // /portail/login et /portail/register (seules pages accessibles sans
    // session citoyen, cf. proxy.ts) gerent leur propre mise en page.
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/portail" className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: "var(--color-primary)" }}
            >
              SM
            </div>
            <div className="text-sm font-semibold">SIGEC-SM — Espace citoyen</div>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--color-text-muted)]">
              {account.citizen.firstName} {account.citizen.lastName}
            </span>
            <CitizenLogoutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-4 px-4 pb-2 text-xs">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
