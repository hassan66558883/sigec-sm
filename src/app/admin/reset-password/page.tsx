import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">
          {user.mustResetPwd ? "Changement de mot de passe requis" : "Changer mon mot de passe"}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {user.mustResetPwd
            ? "Pour des raisons de securite, vous devez definir un nouveau mot de passe avant de continuer."
            : "Definissez un nouveau mot de passe pour votre compte."}
        </p>
      </div>
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <ResetPasswordForm />
      </div>
      {!user.mustResetPwd && (
        <Link href="/admin" className="block text-center text-xs text-[var(--color-text-muted)] hover:underline">
          ← Retour au tableau de bord
        </Link>
      )}
    </div>
  );
}
