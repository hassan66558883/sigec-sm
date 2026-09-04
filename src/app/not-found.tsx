import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-xl">
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md"
          style={{ background: "var(--gradient-primary)" }}
        >
          SM
        </div>
        <h1 className="text-lg font-semibold text-[var(--color-text)]">Page introuvable</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Cette page n&apos;existe pas ou plus.</p>
        <Link
          href="/"
          className="mt-6 inline-block w-full rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          style={{ background: "var(--gradient-primary)" }}
        >
          Retour a l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
