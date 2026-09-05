import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getOpenApiSpec } from "@/lib/integration/openapi-spec";
import { PageHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

const METHOD_COLOR: Record<string, string> = {
  GET: "var(--color-success)",
  POST: "var(--color-primary)",
  PUT: "var(--color-warning)",
  DELETE: "var(--color-danger)",
};

export default async function ApiDocumentationPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "documentation")) redirect("/admin/integration");

  const spec = getOpenApiSpec("");
  const entries = Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods as Record<string, { summary: string; description?: string; responses: Record<string, { description: string }> }>).map(([method, op]) => ({
      path,
      method: method.toUpperCase(),
      op,
    })),
  );

  return (
    <div className="space-y-6">
      <PageHeading
        title="API Documentation"
        description="Endpoints /api/v1/* reellement exposes par l'API Gateway — authentification par cle API (voir Security & Credentials)."
        action={
          <a
            href="/api/v1/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            OpenAPI JSON
          </a>
        }
      />

      <div className="space-y-4">
        {entries.map((entry) => (
          <Card key={`${entry.method}-${entry.path}`}>
            <div className="flex items-center gap-3">
              <span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: METHOD_COLOR[entry.method] ?? "var(--color-text-muted)" }}>
                {entry.method}
              </span>
              <code className="font-mono text-sm" dir="ltr">{entry.path}</code>
            </div>
            <p className="mt-2 text-sm font-medium text-[var(--color-text)]">{entry.op.summary}</p>
            {entry.op.description && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{entry.op.description}</p>}
            <div className="mt-3 space-y-1 text-xs">
              {Object.entries(entry.op.responses).map(([code, res]) => (
                <div key={code} className="flex gap-2">
                  <span className="font-mono text-[var(--color-text-muted)]">{code}</span>
                  <span className="text-[var(--color-text-muted)]">{res.description}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
