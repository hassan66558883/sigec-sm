import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Changement de mot de passe requis</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Pour des raisons de securite, vous devez definir un nouveau mot de passe avant de continuer.
        </p>
      </div>
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
