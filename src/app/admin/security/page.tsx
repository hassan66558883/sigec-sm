import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PageHeading } from "@/components/ui/page-header";
import { MfaPanel } from "./mfa-panel";

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeading
        title="Securite du compte"
        description="Authentification a deux facteurs (MFA) — protege votre compte meme si votre mot de passe est compromis."
      />
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <MfaPanel initialEnabled={user.mfaEnabled} />
      </div>
    </div>
  );
}
