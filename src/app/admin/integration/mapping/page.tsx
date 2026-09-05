import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listMappings, CITIZENS_TARGET_FIELDS, TRANSFORMS } from "@/lib/services/integration-mapping";
import { NewMappingForm } from "@/components/integration/new-mapping-form";
import { DeleteMappingButton } from "@/components/integration/delete-mapping-button";
import { PageHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default async function MappingPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "mapping_manage")) redirect("/admin/integration");

  const mappings = await listMappings(user);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Data Mapping"
        description="Associe les colonnes d'un fichier externe aux champs SIGEC-SM (citoyens) avant tout import."
        action={<NewMappingForm targetFields={CITIZENS_TARGET_FIELDS} transforms={TRANSFORMS} />}
      />

      <div className="space-y-4">
        {mappings.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Aucun mapping configure.</p>}
        {mappings.map((m) => (
          <Card key={m.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[var(--color-text)]">{m.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Entity: {m.entityType} — {m.rules.length} rule(s)</p>
              </div>
              <DeleteMappingButton id={m.id} />
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[var(--color-text-muted)]">
                    <th className="pr-4">Source</th>
                    <th className="pr-4">Target</th>
                    <th>Transform</th>
                  </tr>
                </thead>
                <tbody>
                  {m.rules.map((r) => (
                    <tr key={r.id}>
                      <td className="pr-4 font-mono">{r.sourceField}</td>
                      <td className="pr-4 font-mono">{r.targetField}</td>
                      <td>{r.transform}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
