import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { can, recordScopeWhere } from "@/lib/rbac";

export type SearchResultType = "citizens" | "births" | "marriages" | "deaths" | "certificates" | "applications" | "payments";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  href: string;
};

const MIN_QUERY_LENGTH = 2;
const PER_ENTITY_LIMIT = 5;

// Recherche globale (topbar, section 25) : RBAC + perimetre territorial
// identiques aux pages de liste existantes (memes helpers can()/
// recordScopeWhere() que citizens.ts et consorts, pas de logique
// dupliquee/differente). marriages/deaths/certificates/applications/
// payments n'ont pas de route de detail dediee -> le resultat pointe vers
// la liste du module, pre-filtree via ?search=<numero exact> (meme champ
// que celui recherche ici), pas un enregistrement isole.
export async function globalSearch(user: CurrentUser, query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];
  const scope = recordScopeWhere(user);
  const contains = { contains: q, mode: "insensitive" as const };

  const [citizens, births, marriages, deaths, certificates, applications, payments] = await Promise.all([
    can(user, "citizens", "view")
      ? prisma.citizen.findMany({
          where: { ...scope, OR: [{ firstName: contains }, { lastName: contains }, { uniqueNumber: contains }] },
          select: { id: true, firstName: true, lastName: true, uniqueNumber: true },
          take: PER_ENTITY_LIMIT,
        })
      : [],
    can(user, "births", "view")
      ? prisma.birthRecord.findMany({ where: { ...scope, recordNumber: contains }, select: { id: true, recordNumber: true }, take: PER_ENTITY_LIMIT })
      : [],
    can(user, "marriages", "view")
      ? prisma.marriage.findMany({ where: { ...scope, recordNumber: contains }, select: { id: true, recordNumber: true }, take: PER_ENTITY_LIMIT })
      : [],
    can(user, "deaths", "view")
      ? prisma.deathRecord.findMany({ where: { ...scope, recordNumber: contains }, select: { id: true, recordNumber: true }, take: PER_ENTITY_LIMIT })
      : [],
    can(user, "certificates", "view")
      ? prisma.certificate.findMany({ where: { ...scope, documentNumber: contains }, select: { id: true, documentNumber: true }, take: PER_ENTITY_LIMIT })
      : [],
    can(user, "applications", "view")
      ? prisma.application.findMany({ where: { ...scope, applicationNumber: contains }, select: { id: true, applicationNumber: true, type: true }, take: PER_ENTITY_LIMIT })
      : [],
    can(user, "payments", "view")
      ? prisma.payment.findMany({ where: { ...scope, receiptNumber: contains }, select: { id: true, receiptNumber: true, amount: true }, take: PER_ENTITY_LIMIT })
      : [],
  ]);

  const results: SearchResult[] = [];
  for (const c of citizens) {
    results.push({ id: c.id, type: "citizens", title: `${c.firstName} ${c.lastName}`, subtitle: c.uniqueNumber, href: `/admin/citizens/${c.id}` });
  }
  for (const b of births) {
    results.push({ id: b.id, type: "births", title: b.recordNumber, href: `/admin/births/${b.id}` });
  }
  for (const m of marriages) {
    results.push({ id: m.id, type: "marriages", title: m.recordNumber, href: `/admin/marriages?search=${encodeURIComponent(m.recordNumber)}` });
  }
  for (const d of deaths) {
    results.push({ id: d.id, type: "deaths", title: d.recordNumber, href: `/admin/deaths?search=${encodeURIComponent(d.recordNumber)}` });
  }
  for (const c of certificates) {
    results.push({ id: c.id, type: "certificates", title: c.documentNumber, href: `/admin/certificates?search=${encodeURIComponent(c.documentNumber)}` });
  }
  for (const a of applications) {
    results.push({
      id: a.id,
      type: "applications",
      title: a.applicationNumber,
      subtitle: a.type,
      href: `/admin/applications?search=${encodeURIComponent(a.applicationNumber)}`,
    });
  }
  for (const p of payments) {
    results.push({
      id: p.id,
      type: "payments",
      title: p.receiptNumber,
      subtitle: `${p.amount.toLocaleString("fr-FR")} FCFA`,
      href: `/admin/payments?search=${encodeURIComponent(p.receiptNumber)}`,
    });
  }
  return results;
}
