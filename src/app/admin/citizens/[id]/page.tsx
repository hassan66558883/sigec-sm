import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, recordScopeWhere } from "@/lib/rbac";
import { getCitizen } from "@/lib/services/citizens";
import { ApiError } from "@/lib/api";
import { PageHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, type TabItem } from "@/components/ui/tabs";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-0.5 text-sm text-[var(--color-text)]">{value ?? "—"}</div>
    </div>
  );
}

export default async function CitizenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "citizens", "view")) redirect("/admin");

  let citizen;
  try {
    citizen = await getCitizen(user, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const canViewCertificates = can(user, "certificates", "view");
  const canViewPayments = can(user, "payments", "view");

  const [certificates, payments] = await Promise.all([
    canViewCertificates
      ? prisma.certificate.findMany({
          where: { citizenId: id, ...recordScopeWhere(user) },
          include: { certificateType: true },
          orderBy: { issuedAt: "desc" },
          take: 50,
        })
      : Promise.resolve(null),
    canViewPayments
      ? prisma.payment.findMany({ where: { payerId: id, ...recordScopeWhere(user) }, orderBy: { paymentDate: "desc" }, take: 50 })
      : Promise.resolve(null),
  ]);

  const infoTab = (
    <Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Sexe" value={citizen.sex === "M" ? "Masculin" : "Feminin"} />
        <Field label="Date de naissance" value={citizen.dateOfBirth ? new Date(citizen.dateOfBirth).toLocaleDateString("fr-FR") : null} />
        <Field label="Lieu de naissance" value={citizen.placeOfBirth} />
        <Field label="Nationalite" value={citizen.nationality} />
        <Field label="Situation matrimoniale" value={citizen.maritalStatus} />
        <Field label="Statut" value={citizen.isDeceased ? "Decede" : "Vivant"} />
        <Field label="Telephone" value={citizen.phone} />
        <Field label="Adresse" value={citizen.address} />
        <Field label="Arrondissement" value={citizen.arrondissement.name} />
        <Field label="Quartier" value={citizen.quartier?.name} />
        <Field label="Pere" value={citizen.father ? `${citizen.father.firstName} ${citizen.father.lastName}` : null} />
        <Field label="Mere" value={citizen.mother ? `${citizen.mother.firstName} ${citizen.mother.lastName}` : null} />
      </div>
    </Card>
  );

  const hasFamily = citizen.childrenAsFather.length > 0 || citizen.childrenAsMother.length > 0 || citizen.marriagesAsHusband.length > 0 || citizen.marriagesAsWife.length > 0;
  const familyTab = hasFamily ? (
    <div className="space-y-4">
      {(citizen.childrenAsFather.length > 0 || citizen.childrenAsMother.length > 0) && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Enfants</h2>
          <ul className="space-y-1 text-sm">
            {[...citizen.childrenAsFather, ...citizen.childrenAsMother].map((child) => (
              <li key={child.id}>
                <Link href={`/admin/citizens/${child.id}`} className="text-[var(--color-primary)] hover:underline">
                  {child.firstName} {child.lastName}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {(citizen.marriagesAsHusband.length > 0 || citizen.marriagesAsWife.length > 0) && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Mariages</h2>
          <ul className="space-y-1 text-sm">
            {citizen.marriagesAsHusband.map((m) => (
              <li key={m.id}>
                Avec {m.wife.firstName} {m.wife.lastName} — {new Date(m.marriageDate).toLocaleDateString("fr-FR")} ({m.status})
              </li>
            ))}
            {citizen.marriagesAsWife.map((m) => (
              <li key={m.id}>
                Avec {m.husband.firstName} {m.husband.lastName} — {new Date(m.marriageDate).toLocaleDateString("fr-FR")} ({m.status})
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  ) : (
    <Card>
      <EmptyState title="Aucune information d'etat civil complementaire." />
    </Card>
  );

  const documentsTab = (
    <Card padding="p-0">
      {!certificates || certificates.length === 0 ? (
        <EmptyState title="Aucun document delivre." />
      ) : (
        <ul className="divide-y divide-[var(--color-border-subtle)]">
          {certificates.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <div className="font-medium text-[var(--color-text)]">{c.certificateType.name}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {c.documentNumber} — {new Date(c.issuedAt).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge label={c.status === "VALID" ? "Valide" : "Revoque"} tone={c.status === "VALID" ? "success" : "danger"} />
                <Link href={`/verify/${c.qrToken}`} target="_blank" className="text-xs text-[var(--color-primary)] hover:underline">
                  Verifier →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const paymentsTab = (
    <Card padding="p-0">
      {!payments || payments.length === 0 ? (
        <EmptyState title="Aucun paiement enregistre." />
      ) : (
        <ul className="divide-y divide-[var(--color-border-subtle)]">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <div className="font-medium text-[var(--color-text)]">{formatFcfa(p.amount)}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {p.receiptNumber} — {new Date(p.paymentDate).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <StatusBadge label={p.status} tone={p.status === "PAID" ? "success" : p.status === "PENDING" ? "warning" : "danger"} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const tabs: TabItem[] = [{ id: "info", label: "Informations", content: infoTab }, { id: "family", label: "Etat civil", content: familyTab }];
  if (canViewCertificates) tabs.push({ id: "documents", label: "Documents", content: documentsTab });
  if (canViewPayments) tabs.push({ id: "payments", label: "Paiements", content: paymentsTab });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/citizens" className="text-xs text-[var(--color-primary)] hover:underline">
          ← Citoyens
        </Link>
      </div>

      <PageHeading title={`${citizen.firstName} ${citizen.lastName}`} description={citizen.uniqueNumber} />

      <Tabs tabs={tabs} />
    </div>
  );
}
