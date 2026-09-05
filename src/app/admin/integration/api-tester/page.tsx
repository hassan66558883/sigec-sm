import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { TESTABLE_ENDPOINTS } from "@/lib/integration/openapi-spec";
import { ApiTesterConsole } from "@/components/integration/api-tester-console";
import { PageHeading } from "@/components/ui/page-header";

export default async function ApiTesterPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "documentation")) redirect("/admin/integration");

  return (
    <div className="space-y-6">
      <PageHeading
        title="API Tester"
        description="Console reservee aux administrateurs autorises — envoie un vrai appel a l'API Gateway avec une cle API reelle (voir Security & Credentials pour en generer une)."
      />
      <ApiTesterConsole endpoints={TESTABLE_ENDPOINTS} />
    </div>
  );
}
