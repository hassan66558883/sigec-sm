import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listCertificates } from "@/lib/services/certificates";
import { RevokeButton } from "@/components/civil-status/revoke-button";

export default async function CertificatesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "certificates", "view")) redirect("/admin");

  const certificates = await listCertificates(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Certificats delivres</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Documents officiels avec verification publique par QR code / lien.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Titulaire</th>
              <th className="px-4 py-2.5">Delivre le</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5">Verification</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {certificates.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{c.documentNumber}</td>
                <td className="px-4 py-2.5">{c.certificateType.name}</td>
                <td className="px-4 py-2.5">{c.citizen ? `${c.citizen.firstName} ${c.citizen.lastName}` : "—"}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{new Date(c.issuedAt).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.status === "VALID" ? "bg-green-100 text-[var(--color-success)]" : "bg-red-100 text-[var(--color-danger)]"
                    }`}
                  >
                    {c.status === "VALID" ? "Valide" : "Revoque"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/verify/${c.qrToken}`} target="_blank" className="text-xs text-[var(--color-primary)] hover:underline">
                    Verifier →
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  {c.status === "VALID" && can(user, "certificates", "revoke") && (
                    <RevokeButton endpoint={`/api/certificates/${c.id}`} label="Revoquer" />
                  )}
                </td>
              </tr>
            ))}
            {certificates.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun certificat delivre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
