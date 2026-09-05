import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MfaVerifyForm } from "./mfa-verify-form";

export default async function MfaVerifyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.mfaPending) redirect("/admin");

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Verification en deux etapes</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Saisissez le code affiche par votre application authenticator, ou un de vos codes de secours.
        </p>
      </div>
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <MfaVerifyForm />
      </div>
    </div>
  );
}
