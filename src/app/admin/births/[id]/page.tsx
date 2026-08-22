import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getBirthRecord } from "@/lib/services/births";
import { ApiError } from "@/lib/api";
import { ValidateButton } from "@/components/civil-status/validate-button";
import { RevokeButton } from "@/components/civil-status/revoke-button";
import { IssueCertificateButton } from "@/components/civil-status/issue-certificate-button";

const STATUS_LABEL: Record<string, string> = { DECLARED: "Declaree", REGISTERED: "Enregistree", ANNULLED: "Annulee" };

export default async function BirthDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "births", "view")) redirect("/admin");

  let record;
  try {
    record = await getBirthRecord(user, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const activeCertificate = record.certificates.find((c) => c.status === "VALID");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/births" className="text-xs text-[var(--color-primary)] hover:underline">
          ← Naissances
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-[var(--color-text)]">
          Naissance de {record.child.firstName} {record.child.lastName}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{record.recordNumber} — {STATUS_LABEL[record.status]}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:grid-cols-3">
        <div>
          <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Date de naissance</div>
          <div className="text-sm">{new Date(record.dateOfBirth).toLocaleDateString("fr-FR")}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Lieu</div>
          <div className="text-sm">{record.placeOfBirth}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Declarant</div>
          <div className="text-sm">{record.declarantName} {record.declarantRelation ? `(${record.declarantRelation})` : ""}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Pere</div>
          <div className="text-sm">{record.child.father ? `${record.child.father.firstName} ${record.child.father.lastName}` : "—"}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Mere</div>
          <div className="text-sm">{record.child.mother ? `${record.child.mother.firstName} ${record.child.mother.lastName}` : "—"}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Dossier citoyen</div>
          <Link href={`/admin/citizens/${record.child.id}`} className="text-sm text-[var(--color-primary)] hover:underline">
            {record.child.uniqueNumber}
          </Link>
        </div>
      </div>

      <div className="flex gap-2">
        {record.status === "DECLARED" && can(user, "births", "validate") && (
          <ValidateButton endpoint={`/api/births/${record.id}`} label="Valider / enregistrer l'acte" />
        )}
        {record.status !== "ANNULLED" && can(user, "births", "revoke") && (
          <RevokeButton endpoint={`/api/births/${record.id}`} label="Annuler l'acte" />
        )}
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Certificat / extrait d&apos;acte</h2>
        {activeCertificate ? (
          <div className="space-y-1 text-sm">
            <div>Numero : {activeCertificate.documentNumber}</div>
            <div>Delivre le : {new Date(activeCertificate.issuedAt).toLocaleDateString("fr-FR")}</div>
            <Link href={`/verify/${activeCertificate.qrToken}`} target="_blank" className="text-[var(--color-primary)] hover:underline">
              Voir la page de verification publique →
            </Link>
          </div>
        ) : record.status === "REGISTERED" && can(user, "certificates", "create") ? (
          <IssueCertificateButton sourceType="birth" sourceId={record.id} label="Emettre l'extrait de naissance" />
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            L&apos;acte doit d&apos;abord etre enregistre avant l&apos;emission d&apos;un certificat.
          </p>
        )}
      </div>
    </div>
  );
}
