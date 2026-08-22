import Link from "next/link";

// Rendu par Next.js quand forbidden() est appele dans un Server Component
// sous /admin (ex: acces a un arrondissement hors perimetre territorial).
// Necessite experimental.authInterrupts (voir next.config.mjs).
export default function Forbidden() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
        style={{ background: "var(--color-danger)" }}
      >
        403
      </div>
      <h1 className="text-lg font-semibold text-[var(--color-text)]">Acces refuse</h1>
      <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
        Cette ressource existe mais ne fait pas partie de votre perimetre territorial.
      </p>
      <Link href="/admin" className="text-sm text-[var(--color-primary)] hover:underline">
        ← Retour au tableau de bord
      </Link>
    </div>
  );
}
