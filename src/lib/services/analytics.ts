import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { can, recordScopeWhere, arrondissementScopeWhere } from "@/lib/rbac";
import { scopeSql } from "@/lib/rbac-sql";
import { monthBuckets, monthKey } from "@/lib/date-buckets";

// Statistiques consolidees (section 20/21). Chaque section n'est calculee
// que si l'utilisateur a la permission de vue du module correspondant —
// pas de nouveau module "analytics" separe : la visibilite suit le RBAC
// deja en place, comme partout ailleurs dans l'application.

export async function getPopulationStats(user: CurrentUser) {
  const scope = recordScopeWhere(user);
  const [total, bySex, byMaritalStatus, byArrondissement, households] = await Promise.all([
    prisma.citizen.count({ where: scope }),
    prisma.citizen.groupBy({ by: ["sex"], where: scope, _count: true }),
    prisma.citizen.groupBy({ by: ["maritalStatus"], where: scope, _count: true }),
    user.hasGlobalScope
      ? prisma.citizen.groupBy({ by: ["arrondissementId"], where: scope, _count: true })
      : Promise.resolve([]),
    prisma.household.count({ where: scope }),
  ]);

  let arrondissementBreakdown: { name: string; count: number }[] = [];
  if (user.hasGlobalScope && byArrondissement.length > 0) {
    const arrondissements = await prisma.arrondissement.findMany({ select: { id: true, name: true } });
    const byId = new Map(arrondissements.map((a) => [a.id, a.name]));
    arrondissementBreakdown = byArrondissement.map((row) => ({
      name: byId.get(row.arrondissementId) ?? "Inconnu",
      count: row._count,
    }));
  }

  return {
    total,
    households,
    bySex: bySex.map((r) => ({ sex: r.sex, count: r._count })),
    byMaritalStatus: byMaritalStatus.map((r) => ({ status: r.maritalStatus, count: r._count })),
    arrondissementBreakdown,
  };
}

const YEAR_START = new Date(new Date().getFullYear(), 0, 1);

export async function getCivilStatusStats(user: CurrentUser) {
  const scope = recordScopeWhere(user);
  const yearFilter = { ...scope, createdAt: { gte: YEAR_START } };

  const [births, marriages, divorces, deaths, recognitions, certificates] = await Promise.all([
    can(user, "births", "view")
      ? Promise.all([prisma.birthRecord.count({ where: scope }), prisma.birthRecord.count({ where: yearFilter })])
      : null,
    can(user, "marriages", "view")
      ? Promise.all([prisma.marriage.count({ where: scope }), prisma.marriage.count({ where: yearFilter })])
      : null,
    can(user, "divorces", "view")
      ? Promise.all([prisma.divorce.count({ where: scope }), prisma.divorce.count({ where: yearFilter })])
      : null,
    can(user, "deaths", "view")
      ? Promise.all([prisma.deathRecord.count({ where: scope }), prisma.deathRecord.count({ where: yearFilter })])
      : null,
    can(user, "recognitions", "view")
      ? Promise.all([prisma.recognition.count({ where: scope }), prisma.recognition.count({ where: yearFilter })])
      : null,
    can(user, "certificates", "view")
      ? Promise.all([
          prisma.certificate.count({ where: { ...scope, status: "VALID" } }),
          prisma.certificate.count({ where: { ...scope, status: "VALID", issuedAt: { gte: YEAR_START } } }),
        ])
      : null,
  ]);

  return {
    births: births ? { total: births[0], thisYear: births[1] } : null,
    marriages: marriages ? { total: marriages[0], thisYear: marriages[1] } : null,
    divorces: divorces ? { total: divorces[0], thisYear: divorces[1] } : null,
    deaths: deaths ? { total: deaths[0], thisYear: deaths[1] } : null,
    recognitions: recognitions ? { total: recognitions[0], thisYear: recognitions[1] } : null,
    certificates: certificates ? { total: certificates[0], thisYear: certificates[1] } : null,
  };
}

export async function getServicesStats(user: CurrentUser) {
  const scope = recordScopeWhere(user);

  const [applications, complaints, urbanCases, parcels] = await Promise.all([
    can(user, "applications", "view")
      ? prisma.application.groupBy({ by: ["status"], where: scope, _count: true })
      : null,
    can(user, "complaints", "view")
      ? prisma.complaint.groupBy({ by: ["status"], where: scope, _count: true })
      : null,
    can(user, "urbanism", "view")
      ? prisma.urbanPlanningCase.groupBy({ by: ["status"], where: scope, _count: true })
      : null,
    can(user, "land", "view") ? prisma.landParcel.groupBy({ by: ["status"], where: scope, _count: true }) : null,
  ]);

  const toBreakdown = (rows: { status: string; _count: number }[] | null) =>
    rows ? rows.map((r) => ({ status: r.status, count: r._count })) : null;

  return {
    applications: toBreakdown(applications),
    complaints: toBreakdown(complaints),
    urbanCases: toBreakdown(urbanCases),
    parcels: toBreakdown(parcels),
  };
}

// Indicateurs de recouvrement + repartition en ligne/physique (module
// paiement en ligne, section 15/16). Taux de recouvrement = montant
// effectivement paye / montant total du (obligations non annulees), jamais
// stocke, toujours recalcule. La repartition en ligne/physique se base sur
// MobileMoneyTransaction.channel="ONLINE" (paiement initie depuis le
// portail) — tout le reste (especes, virement, Mobile Money collecte par un
// agent) est considere "physique".
export async function getRecoveryStats(user: CurrentUser) {
  if (!can(user, "obligations", "view") || !can(user, "payments", "view")) return null;
  const scope = recordScopeWhere(user);

  const [dueAgg, onlineAgg, totalPaidAgg] = await Promise.all([
    prisma.obligationPaiement.aggregate({
      where: { ...scope, status: { not: "ANNULE" } },
      _sum: { initialAmount: true, penaltyAmount: true, discountAmount: true, paidAmount: true },
    }),
    prisma.payment.aggregate({
      where: { ...scope, status: "PAID", mobileMoney: { channel: "ONLINE" } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({ where: { ...scope, status: "PAID" }, _sum: { amount: true }, _count: true }),
  ]);

  const totalDue =
    (dueAgg._sum.initialAmount ?? 0) + (dueAgg._sum.penaltyAmount ?? 0) - (dueAgg._sum.discountAmount ?? 0);
  const totalPaidOnObligations = dueAgg._sum.paidAmount ?? 0;
  const recoveryRate = totalDue > 0 ? Math.round((totalPaidOnObligations / totalDue) * 1000) / 10 : 0;

  const onlineTotal = onlineAgg._sum.amount ?? 0;
  const onlineCount = onlineAgg._count;
  const totalPaid = totalPaidAgg._sum.amount ?? 0;
  const totalPaidCount = totalPaidAgg._count;

  return {
    totalDue,
    totalPaidOnObligations,
    recoveryRate,
    online: { total: onlineTotal, count: onlineCount },
    physical: { total: totalPaid - onlineTotal, count: totalPaidCount - onlineCount },
  };
}

// Rapport statistique consolide par arrondissement : une ligne par
// arrondissement dans le perimetre de l'utilisateur, une colonne par
// module — chaque colonne n'est calculee (et exposee au CSV) que si
// l'utilisateur a la permission de vue du module correspondant, meme
// logique de visibilite que getCivilStatusStats/getServicesStats.
export async function getArrondissementStatsReport(user: CurrentUser) {
  const scope = recordScopeWhere(user);

  const [arrondissements, citizens, households, births, marriages, divorces, deaths, revenue, unpaid, markets, businesses, applications] =
    await Promise.all([
      prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
      can(user, "citizens", "view")
        ? prisma.citizen.groupBy({ by: ["arrondissementId"], where: scope, _count: true })
        : null,
      can(user, "households", "view")
        ? prisma.household.groupBy({ by: ["arrondissementId"], where: scope, _count: true })
        : null,
      can(user, "births", "view")
        ? prisma.birthRecord.groupBy({ by: ["arrondissementId"], where: scope, _count: true })
        : null,
      can(user, "marriages", "view")
        ? prisma.marriage.groupBy({ by: ["arrondissementId"], where: scope, _count: true })
        : null,
      can(user, "divorces", "view")
        ? prisma.divorce.groupBy({ by: ["arrondissementId"], where: scope, _count: true })
        : null,
      can(user, "deaths", "view")
        ? prisma.deathRecord.groupBy({ by: ["arrondissementId"], where: scope, _count: true })
        : null,
      can(user, "payments", "view")
        ? prisma.payment.groupBy({ by: ["arrondissementId"], where: { ...scope, status: "PAID" }, _sum: { amount: true } })
        : null,
      can(user, "obligations", "view")
        ? prisma.obligationPaiement.groupBy({
            by: ["arrondissementId"],
            where: { ...scope, status: { in: ["A_PAYER", "PARTIELLEMENT_PAYE", "EN_RETARD"] } },
            _count: true,
          })
        : null,
      can(user, "markets", "view")
        ? prisma.market.groupBy({ by: ["arrondissementId"], where: scope, _count: true })
        : null,
      can(user, "businesses", "view")
        ? prisma.business.groupBy({ by: ["arrondissementId"], where: scope, _count: true })
        : null,
      can(user, "applications", "view")
        ? prisma.application.groupBy({ by: ["arrondissementId"], where: scope, _count: true })
        : null,
    ]);

  const countMap = (rows: { arrondissementId: string | null; _count: number }[] | null) =>
    rows && new Map(rows.map((r) => [r.arrondissementId, r._count]));
  const sumMap = (rows: { arrondissementId: string | null; _sum: { amount: number | null } }[] | null) =>
    rows && new Map(rows.map((r) => [r.arrondissementId, r._sum.amount ?? 0]));

  const citizensMap = countMap(citizens);
  const householdsMap = countMap(households);
  const birthsMap = countMap(births);
  const marriagesMap = countMap(marriages);
  const divorcesMap = countMap(divorces);
  const deathsMap = countMap(deaths);
  const revenueMap = sumMap(revenue);
  const unpaidMap = countMap(unpaid);
  const marketsMap = countMap(markets);
  const businessesMap = countMap(businesses);
  const applicationsMap = countMap(applications);

  return arrondissements.map((a) => ({
    id: a.id,
    name: a.name,
    code: a.code,
    population: citizensMap ? citizensMap.get(a.id) ?? 0 : null,
    menages: householdsMap ? householdsMap.get(a.id) ?? 0 : null,
    naissances: birthsMap ? birthsMap.get(a.id) ?? 0 : null,
    mariages: marriagesMap ? marriagesMap.get(a.id) ?? 0 : null,
    divorces: divorcesMap ? divorcesMap.get(a.id) ?? 0 : null,
    deces: deathsMap ? deathsMap.get(a.id) ?? 0 : null,
    recettes: revenueMap ? revenueMap.get(a.id) ?? 0 : null,
    impayes: unpaidMap ? unpaidMap.get(a.id) ?? 0 : null,
    marches: marketsMap ? marketsMap.get(a.id) ?? 0 : null,
    commerces: businessesMap ? businessesMap.get(a.id) ?? 0 : null,
    demandes: applicationsMap ? applicationsMap.get(a.id) ?? 0 : null,
  }));
}

type MonthCountRow = { bucket: Date; count: bigint };

async function monthlyCounts(table: string, dateColumn: string, user: CurrentUser, since: Date) {
  const col = Prisma.raw(`"${dateColumn}"`);
  const tbl = Prisma.raw(`"${table}"`);
  const rows = await prisma.$queryRaw<MonthCountRow[]>(Prisma.sql`
    SELECT date_trunc('month', ${col}) AS bucket, COUNT(*) AS count
    FROM ${tbl}
    WHERE ${scopeSql(user)} AND ${col} >= ${since}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);
  return new Map(rows.map((r) => [monthKey(new Date(r.bucket)), Number(r.count)]));
}

// Evolution de la population enregistree (tableau de bord, section 8) :
// total cumule mois par mois, ancre sur le total reel actuel (pas seulement
// les inscriptions du dernier mois) — Citizen.createdAt = date
// d'enregistrement dans SIGEC-SM. Agregation Postgres (date_trunc), pas de
// regroupement cote Node : le graphique n'a besoin que de ~12-36 points,
// alors que la table Citizen grossit sans limite.
export async function getPopulationTrend(user: CurrentUser, months = 12) {
  if (!can(user, "citizens", "view")) return [];
  const buckets = monthBuckets(months);
  const since = buckets[0].date;

  const [baseline, byMonth] = await Promise.all([
    prisma.citizen.count({ where: { ...recordScopeWhere(user), createdAt: { lt: since } } }),
    monthlyCounts("Citizen", "createdAt", user, since),
  ]);

  let running = baseline;
  return buckets.map((b) => {
    running += byMonth.get(b.key) ?? 0;
    return { month: b.label, population: running };
  });
}

// Activite mensuelle de l'etat civil (tableau de bord, section 9) :
// naissances/mariages/deces/actes delivres par mois — chaque serie n'est
// calculee que si l'utilisateur a la permission de vue du module
// correspondant (meme logique que getCivilStatusStats).
export async function getCivilStatusTrend(user: CurrentUser, months = 12) {
  const buckets = monthBuckets(months);
  const since = buckets[0].date;

  const [births, marriages, deaths, certificates] = await Promise.all([
    can(user, "births", "view") ? monthlyCounts("BirthRecord", "createdAt", user, since) : null,
    can(user, "marriages", "view") ? monthlyCounts("Marriage", "createdAt", user, since) : null,
    can(user, "deaths", "view") ? monthlyCounts("DeathRecord", "createdAt", user, since) : null,
    can(user, "certificates", "view") ? monthlyCounts("Certificate", "issuedAt", user, since) : null,
  ]);

  if (!births && !marriages && !deaths && !certificates) return [];

  return buckets.map((b) => ({
    month: b.label,
    ...(births ? { naissances: births.get(b.key) ?? 0 } : {}),
    ...(marriages ? { mariages: marriages.get(b.key) ?? 0 } : {}),
    ...(deaths ? { deces: deaths.get(b.key) ?? 0 } : {}),
    ...(certificates ? { certificats: certificates.get(b.key) ?? 0 } : {}),
  }));
}
