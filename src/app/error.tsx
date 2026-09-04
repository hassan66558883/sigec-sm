"use client";

import { useEffect } from "react";

// Limite globale (App Router : les error.tsx doivent etre des Client
// Components) — sans elle, une erreur non interceptee affichait l'ecran
// d'erreur brut par defaut de Next.js plutot qu'une page coherente avec le
// reste de l'app (voir audit performance/resilience 2026-09-02). Les
// error.tsx par segment (ex. src/app/admin/error.tsx) peuvent etre ajoutes
// plus tard s'il faut un traitement different par zone ; celui-ci sert de
// filet pour toute l'application.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-xl">
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md"
          style={{ background: "var(--gradient-primary)" }}
        >
          SM
        </div>
        <h1 className="text-lg font-semibold text-[var(--color-text)]">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Quelque chose s&apos;est mal passe de notre cote. Vous pouvez reessayer, ou revenir a l&apos;ecran precedent.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 w-full rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          style={{ background: "var(--gradient-primary)" }}
        >
          Reessayer
        </button>
      </div>
    </div>
  );
}
