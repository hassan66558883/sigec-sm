import { ChangePasswordForm } from "./change-password-form";

export default function ChangePasswordPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Mon mot de passe</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Definissez un nouveau mot de passe pour votre compte.</p>
      </div>
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
