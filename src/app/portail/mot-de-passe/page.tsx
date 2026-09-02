import { ChangePasswordForm } from "./change-password-form";
import { PageHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default function ChangePasswordPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <PageHeading title="Mon mot de passe" description="Definissez un nouveau mot de passe pour votre compte." />
      <Card>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
