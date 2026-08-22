import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { can, recordScopeWhere, arrondissementScopeWhere } from "@/lib/rbac";

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

// Rapport statistique consolide par arrondissement : une ligne par
// arrondissement dans le perimetre de l'utilisateur, une colonne par
// module — chaque colonne n'est calculee (et exposee au CSV) que si
// l'utilisateur a la permission de vue du module correspondant, meme
// logique de visibilite que getCivilStatusStats/getServicesStats.
export async function getArrondissementStatsReport(user: CurrentUser) {
  const scope = recordScopeWhere(user);

  const [arrondissements, citizens, households, births, marriages, divorces, deaths, revenue, unpaid] =
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

  return arrondissements.map((a) => ({
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
  }));
}
