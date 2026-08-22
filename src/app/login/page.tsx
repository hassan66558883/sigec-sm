import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ background: "var(--color-primary)" }}
          >
            SM
          </div>
          <h1 className="text-lg font-semibold text-[var(--color-text)]">SIGEC-SM</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Ville de N&apos;Djamena — Espace administratif
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
          Acces reserve aux agents et responsables municipaux autorises.
        </p>
      </div>
    </div>
  );
}
