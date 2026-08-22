import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listRecognitions } from "@/lib/services/recognitions";
import { listCitizens } from "@/lib/services/citizens";
import { DeclareRecognitionForm } from "@/components/civil-status/declare-recognition-form";
import { ValidateButton } from "@/components/civil-status/validate-button";
import { IssueCertificateButton } from "@/components/civil-status/issue-certificate-button";

const STATUS_LABEL: Record<string, string> = { DECLARED: "Declaree", VALIDATED: "Validee" };
const STATUS_CLASS: Record<string, string> = {
  DECLARED: "bg-amber-100 text-[var(--color-warning)]",
  VALIDATED: "bg-green-100 text-[var(--color-success)]",
};

export default async function RecognitionsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "recognitions", "view")) redirect("/admin");

  const [records, arrondissements, citizens] = await Promise.all([
    listRecognitions(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Reconnaissances d&apos;enfant</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Declaration de reconnaissance par le pere ou la mere.</p>
        </div>
        {can(user, "recognitions", "create") && (
          <DeclareRecognitionForm
            arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
            citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Enfant</th>
              <th className="px-4 py-2.5">Parent</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {records.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{r.recordNumber}</td>
                <td className="px-4 py-2.5 font-medium">{r.child.firstName} {r.child.lastName}</td>
                <td className="px-4 py-2.5">{r.parent.firstName} {r.parent.lastName} ({r.parentRole === "FATHER" ? "Pere" : "Mere"})</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    {r.status === "DECLARED" && can(user, "recognitions", "validate") && (
                      <ValidateButton endpoint={`/api/recognitions/${r.id}`} />
                    )}
                    {r.status === "VALIDATED" && can(user, "certificates", "create") && (
                      <IssueCertificateButton sourceType="recognition" sourceId={r.id} label="Certificat" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucune reconnaissance enregistree.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
