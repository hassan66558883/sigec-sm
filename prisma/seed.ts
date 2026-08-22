// Seed Phase 1 : ville de N'Djamena, 10 arrondissements (placeholders a valider
// par la mairie), permissions granulaires, roles systeme (section 18 du cahier
// des charges) et un compte SUPER_ADMIN initial.
//
// IMPORTANT : les noms d'arrondissements ci-dessous sont des placeholders
// numerotes ("Arrondissement 1" a "10"). Conformement a la regle 39 du cahier
// des charges, aucune denomination officielle n'est inventee ici — a
// renommer par l'administration via /admin/arrondissements une fois les
// denominations officielles confirmees.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MODULES_ACTIONS: Record<string, string[]> = {
  territorial: ["view", "create", "edit", "delete", "export"],
  departments: ["view", "create", "edit", "delete"],
  users: ["view", "create", "edit", "delete", "export"],
  roles: ["view", "create", "edit", "delete"],
  audit: ["view", "export"],
  settings: ["view", "edit"],
  // Phase 2 — Etat civil
  citizens: ["view", "create", "edit", "export"],
  households: ["view", "create", "edit", "export"],
  births: ["view", "create", "validate", "revoke", "export"],
  recognitions: ["view", "create", "validate"],
  marriages: ["view", "create", "validate", "export"],
  divorces: ["view", "create", "validate", "export"],
  deaths: ["view", "create", "validate", "export"],
  certificates: ["view", "create", "print", "revoke"],
  // Phase 3 — Portail citoyen
  applications: ["view", "approve", "reject"],
  // Phase 4 — Foncier et urbanisme
  land: ["view", "create", "issue_title"],
  urbanism: ["view", "create", "review", "inspect", "decide"],
  // Phase 5 — Finances municipales
  businesses: ["view", "create", "edit"],
  markets: ["view", "create", "edit"],
  payments: ["view", "create", "export", "cancel"],
  // Phase 6 — Services municipaux
  associations: ["view", "create", "edit"],
  complaints: ["view", "assign", "update"],
  infrastructure: ["view", "update"],
  // Phase 7 — Recettes municipales : recensement, tarification, agents
  // collecteurs, obligations, reçus (chaine complete section "recettes
  // municipales" du cahier des charges).
  tariffs: ["view", "create", "edit"],
  obligations: ["view", "create", "cancel"],
  collectors: ["view", "create", "edit", "assign"],
  receipts: ["view", "export", "cancel"],
  // Phase 8 — Caisses, versements, Mobile Money, controle anti-fraude.
  caisses: ["view", "create", "edit"],
  versements: ["view", "create", "validate"],
  mobile_money: ["view", "confirm"],
  fraud: ["view", "resolve"],
};

// Types de taxes : montants PLACEHOLDER a valider par la mairie/autorite
// competente (regle 39 — aucun bareme officiel invente ici).
const TAX_TYPES = [
  { code: "PATENTE_ANNUELLE", name: "Patente annuelle (a valider)", amount: 50000 },
  { code: "TAXE_MARCHE_JOUR", name: "Taxe de marche journaliere (a valider)", amount: 500 },
  { code: "TAXE_OCCUPATION", name: "Taxe d'occupation du domaine public (a valider)", amount: 10000 },
];

// Referentiel activites economiques (section 9) — liste PLACEHOLDER,
// configurable/extensible par l'administration (regle 39).
const ACTIVITIES = [
  { code: "ALIMENTATION_GENERALE", name: "Alimentation generale" },
  { code: "RESTAURANT", name: "Restaurant" },
  { code: "ATELIER", name: "Atelier" },
  { code: "SALON_COIFFURE", name: "Salon de coiffure" },
  { code: "BOUTIQUE", name: "Boutique" },
  { code: "KIOSQUE", name: "Kiosque" },
  { code: "COMMERCE_DETAIL", name: "Commerce de detail" },
  { code: "COMMERCE_GROS", name: "Commerce de gros" },
  { code: "AUTRE_ACTIVITE", name: "Autre" },
];

// Referentiel tarifaire municipal (section 10) — montants PLACEHOLDER a
// valider par la mairie/autorite competente (regle 39), meme logique que
// TAX_TYPES ci-dessus. emplacementType: BOUTIQUE | MARCHE | ETAL | AUTRE.
const TARIFFS = [
  { code: "TARIF_BOUTIQUE_MENSUEL", label: "Taxe boutique mensuelle (a valider)", emplacementType: "BOUTIQUE", periodicity: "MENSUELLE", amount: 5000 },
  { code: "TARIF_ETAL_JOURNALIER", label: "Taxe etal journaliere (a valider)", emplacementType: "ETAL", periodicity: "JOURNALIERE", amount: 500 },
  { code: "TARIF_MARCHE_ANNUEL", label: "Taxe occupation marche annuelle (a valider)", emplacementType: "MARCHE", periodicity: "ANNUELLE", amount: 30000 },
];

// Types de certificats lies a un acte d'etat civil (section 7/16). Types
// municipaux generiques (residence, celibat...) : phase 3 (portail citoyen).
const CERTIFICATE_TYPES = [
  { code: "BIRTH_CERTIFICATE", name: "Extrait d'acte de naissance" },
  { code: "RECOGNITION_CERTIFICATE", name: "Attestation de reconnaissance" },
  { code: "MARRIAGE_CERTIFICATE", name: "Extrait d'acte de mariage" },
  { code: "DEATH_CERTIFICATE", name: "Extrait d'acte de deces" },
  { code: "BUILDING_PERMIT", name: "Permis de construire" },
  { code: "DEMOLITION_PERMIT", name: "Autorisation de demolition" },
];

// Regimes matrimoniaux : liste PLACEHOLDER a valider par la mairie/autorite
// competente (regle 39 — aucune regle juridique tchadienne presumee).
const MARRIAGE_REGIMES = [
  { code: "COMMUNITY", name: "Regime de la communaute (a valider)" },
  { code: "SEPARATION", name: "Regime de la separation de biens (a valider)" },
];

// Services / directions centrales de la Mairie Centrale (section "Services
// centraux"). Purement organisationnel — n'accorde aucun acces ; les
// permissions restent portees par les roles.
const DEPARTMENTS = [
  { code: "DGS", name: "Direction Generale des Services", description: "Coordination des services centraux." },
  { code: "DEC", name: "Direction de l'Etat Civil", description: "Naissances, mariages, deces, actes (phase 2)." },
  { code: "DFT", name: "Direction des Finances et Taxes", description: "Patentes, taxes, recettes municipales (phase 5)." },
  { code: "DUF", name: "Direction de l'Urbanisme et du Foncier", description: "Parcelles, titres, permis (phase 4)." },
  { code: "DSM", name: "Direction des Services Municipaux", description: "Marches, associations, plaintes, voirie (phase 6)." },
];

const ROLES: {
  code: string;
  name: string;
  description: string;
  permissions: string[]; // "*" per module, or "module:action" entries, or "ALL"
}[] = [
  {
    code: "SUPER_ADMIN",
    name: "Super Administrateur",
    description: "Acces complet a la plateforme, tous modules et arrondissements.",
    permissions: ["ALL"],
  },
  {
    code: "MUNICIPAL_ADMIN",
    name: "Administrateur municipal",
    description: "Gestion administrative centrale (hors suppression de roles).",
    permissions: [
      "territorial:view", "territorial:create", "territorial:edit", "territorial:export",
      "departments:view", "departments:create", "departments:edit",
      "users:view", "users:create", "users:edit", "users:export",
      "roles:view", "roles:create", "roles:edit",
      "audit:view", "audit:export",
      "settings:view", "settings:edit",
      "citizens:view", "citizens:create", "citizens:edit", "citizens:export",
      "households:view", "households:create", "households:edit", "households:export",
      "births:view", "births:create", "births:validate", "births:revoke", "births:export",
      "recognitions:view", "recognitions:create", "recognitions:validate",
      "marriages:view", "marriages:create", "marriages:validate", "marriages:export",
      "divorces:view", "divorces:create", "divorces:validate", "divorces:export",
      "deaths:view", "deaths:create", "deaths:validate", "deaths:export",
      "certificates:view", "certificates:create", "certificates:print", "certificates:revoke",
      "applications:view", "applications:approve", "applications:reject",
      "land:view", "land:create", "land:issue_title",
      "urbanism:view", "urbanism:create", "urbanism:review", "urbanism:inspect", "urbanism:decide",
      "businesses:view", "businesses:create", "businesses:edit", "markets:view", "markets:create", "markets:edit",
      "payments:view", "payments:create", "payments:export", "payments:cancel",
      "associations:view", "associations:create", "associations:edit",
      "complaints:view", "complaints:assign", "complaints:update",
      "infrastructure:view", "infrastructure:update",
      "tariffs:view", "tariffs:create", "tariffs:edit",
      "obligations:view", "obligations:create", "obligations:cancel",
      "collectors:view", "collectors:create", "collectors:edit", "collectors:assign",
      "receipts:view", "receipts:export", "receipts:cancel",
      "caisses:view", "caisses:create", "caisses:edit",
      "versements:view", "versements:create", "versements:validate",
      "mobile_money:view", "mobile_money:confirm",
      "fraud:view", "fraud:resolve",
    ],
  },
  {
    code: "MAYOR",
    name: "Maire",
    description: "Vision globale des 10 arrondissements, dashboards et statistiques.",
    permissions: [
      "territorial:view", "departments:view", "users:view", "roles:view", "audit:view",
      "citizens:view", "citizens:export", "households:view", "households:export",
      "births:view", "births:export", "recognitions:view",
      "marriages:view", "marriages:export", "divorces:view", "divorces:export",
      "deaths:view", "deaths:export", "certificates:view", "applications:view",
      "land:view", "urbanism:view",
      "businesses:view", "markets:view", "payments:view", "payments:export",
      "associations:view", "complaints:view", "infrastructure:view",
      "tariffs:view", "obligations:view", "collectors:view", "receipts:view",
      "caisses:view", "versements:view", "mobile_money:view", "fraud:view",
    ],
  },
  {
    code: "ARRONDISSEMENT_HEAD",
    name: "Responsable d'arrondissement",
    description: "Dashboard, supervision et pouvoir de validation limites a son/ses arrondissement(s).",
    permissions: [
      "territorial:view", "users:view", "audit:view",
      "citizens:view", "citizens:export", "households:view", "households:export",
      "births:view", "births:validate", "births:revoke", "births:export",
      "recognitions:view", "recognitions:validate",
      "marriages:view", "marriages:validate", "marriages:export",
      "divorces:view", "divorces:validate", "divorces:export",
      "deaths:view", "deaths:validate", "deaths:export",
      "certificates:view", "certificates:revoke",
      "applications:view", "applications:approve", "applications:reject",
      "land:view", "land:issue_title",
      "urbanism:view", "urbanism:decide",
      "businesses:view", "businesses:create", "businesses:edit", "markets:view", "markets:create", "markets:edit",
      "payments:view", "payments:create", "payments:export", "payments:cancel",
      "associations:view", "associations:create", "associations:edit",
      "complaints:view", "complaints:assign", "complaints:update",
      "infrastructure:view", "infrastructure:update",
      "tariffs:view",
      "obligations:view", "obligations:create", "obligations:cancel",
      "collectors:view", "collectors:assign",
      "receipts:view",
      "caisses:view", "caisses:edit",
      "versements:view", "versements:validate",
      "mobile_money:view", "mobile_money:confirm",
      "fraud:view", "fraud:resolve",
    ],
  },
  {
    code: "SERVICE_CHIEF",
    name: "Chef de service",
    description: "Validation des dossiers et emission des documents au sein de son arrondissement.",
    permissions: [
      "citizens:view", "households:view",
      "births:view", "births:validate",
      "recognitions:view", "recognitions:validate",
      "marriages:view", "marriages:validate",
      "divorces:view", "divorces:validate",
      "deaths:view", "deaths:validate",
      "certificates:view", "certificates:create", "certificates:print",
      "applications:view", "applications:approve", "applications:reject",
      "land:view", "urbanism:view", "urbanism:review", "urbanism:inspect",
      "associations:view", "associations:edit",
      "complaints:view", "complaints:assign", "complaints:update",
      "infrastructure:view", "infrastructure:update",
    ],
  },
  {
    code: "CIVIL_STATUS_AGENT",
    name: "Agent d'etat civil",
    description: "Declaration des naissances, reconnaissances, mariages, divorces et deces.",
    permissions: [
      "citizens:view", "citizens:create", "citizens:edit",
      "households:view", "households:create",
      "births:view", "births:create",
      "recognitions:view", "recognitions:create",
      "marriages:view", "marriages:create",
      "divorces:view", "divorces:create",
      "deaths:view", "deaths:create",
      "certificates:view",
      "applications:view",
    ],
  },
  {
    code: "CENSUS_AGENT",
    name: "Agent recensement",
    description: "Recensement des contribuables, boutiques et emplacements (module recettes municipales).",
    permissions: [
      "citizens:view", "citizens:create", "citizens:edit",
      "households:view", "households:create",
      "businesses:view", "businesses:create", "businesses:edit",
      "markets:view",
      "tariffs:view",
      "obligations:view", "obligations:create",
    ],
  },
  {
    code: "LAND_AGENT",
    name: "Agent foncier",
    description: "Parcelles, titres, lotissements.",
    permissions: ["land:view", "land:create", "land:issue_title"],
  },
  {
    code: "URBAN_PLANNING_AGENT",
    name: "Agent urbanisme",
    description: "Instruction des permis de construire et autorisations de demolition.",
    permissions: ["urbanism:view", "urbanism:create", "urbanism:review", "urbanism:inspect", "land:view"],
  },
  {
    code: "TAX_AGENT",
    name: "Agent taxes/finances",
    description: "Agent collecteur : enregistrement des patentes et recettes municipales.",
    permissions: [
      "citizens:view",
      "businesses:view", "businesses:create",
      "payments:view", "payments:create",
      "obligations:view",
      "receipts:view",
      "caisses:view", "caisses:create", "caisses:edit",
      "versements:view", "versements:create",
      "mobile_money:view", "mobile_money:confirm",
    ],
  },
  {
    code: "MARKET_AGENT",
    name: "Agent marche",
    description: "Agent collecteur : gestion des marches, emplacements et recettes associees.",
    permissions: [
      "citizens:view",
      "markets:view", "markets:create",
      "payments:view", "payments:create",
      "obligations:view",
      "receipts:view",
      "caisses:view", "caisses:create", "caisses:edit",
      "versements:view", "versements:create",
      "mobile_money:view", "mobile_money:confirm",
    ],
  },
  {
    code: "ASSOCIATIONS_AGENT",
    name: "Agent associations",
    description: "Enregistrement et suivi des associations et ONG.",
    permissions: ["associations:view", "associations:create", "associations:edit"],
  },
  {
    code: "COMPLAINTS_AGENT",
    name: "Agent plaintes",
    description: "Traitement des plaintes et doleances citoyennes.",
    permissions: ["complaints:view", "complaints:assign", "complaints:update"],
  },
  {
    code: "ROADS_AGENT",
    name: "Agent voirie",
    description: "Suivi des signalements de voirie et infrastructures.",
    permissions: ["infrastructure:view", "infrastructure:update"],
  },
  {
    code: "AUDITOR",
    name: "Auditeur",
    description: "Lecture seule sur l'ensemble des modules, vision globale.",
    permissions: [
      "territorial:view", "departments:view", "users:view", "roles:view", "audit:view",
      "citizens:view", "citizens:export", "households:view", "households:export",
      "births:view", "births:export", "recognitions:view",
      "marriages:view", "marriages:export", "divorces:view", "divorces:export",
      "deaths:view", "deaths:export", "certificates:view", "applications:view",
      "land:view", "urbanism:view",
      "businesses:view", "markets:view", "payments:view", "payments:export",
      "tariffs:view", "obligations:view", "collectors:view", "receipts:view",
      "caisses:view", "versements:view", "mobile_money:view", "fraud:view",
    ],
  },
  { code: "CITIZEN", name: "Citoyen", description: "Compte du portail citoyen (phase 3) — aucun acces a l'espace administratif.", permissions: [] },
];

async function main() {
  console.log("Seed SIGEC-SM — Phase 1 (fondation)");

  const city = await prisma.city.upsert({
    where: { code: "NDJ" },
    update: {},
    create: { name: "N'Djamena", code: "NDJ" },
  });

  for (let number = 1; number <= 10; number++) {
    const code = `NDJ-${String(number).padStart(2, "0")}`;
    await prisma.arrondissement.upsert({
      where: { code },
      update: {},
      create: { cityId: city.id, number, name: `Arrondissement ${number}`, code },
    });
  }
  console.log("  ✓ Ville de N'Djamena et 10 arrondissements");

  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
  }
  console.log(`  ✓ ${DEPARTMENTS.length} services centraux (Mairie Centrale)`);

  for (const type of CERTIFICATE_TYPES) {
    await prisma.certificateType.upsert({ where: { code: type.code }, update: {}, create: type });
  }
  console.log(`  ✓ ${CERTIFICATE_TYPES.length} types de certificats`);

  for (const regime of MARRIAGE_REGIMES) {
    await prisma.marriageRegime.upsert({ where: { code: regime.code }, update: {}, create: regime });
  }
  console.log(`  ✓ ${MARRIAGE_REGIMES.length} regimes matrimoniaux (placeholders — a valider)`);

  for (const tax of TAX_TYPES) {
    await prisma.taxType.upsert({ where: { code: tax.code }, update: {}, create: tax });
  }
  console.log(`  ✓ ${TAX_TYPES.length} types de taxes (placeholders — a valider)`);

  for (const activity of ACTIVITIES) {
    await prisma.activiteEconomique.upsert({ where: { code: activity.code }, update: {}, create: activity });
  }
  console.log(`  ✓ ${ACTIVITIES.length} activites economiques (referentiel)`);

  for (const tarif of TARIFFS) {
    const existing = await prisma.tarifMunicipal.findFirst({ where: { code: tarif.code } });
    if (!existing) await prisma.tarifMunicipal.create({ data: tarif });
  }
  console.log(`  ✓ ${TARIFFS.length} tarifs municipaux (placeholders — a valider)`);

  const permissionIdByCode = new Map<string, string>();
  for (const [module, actions] of Object.entries(MODULES_ACTIONS)) {
    for (const action of actions) {
      const code = `${module}:${action}`;
      const perm = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { module, action, code },
      });
      permissionIdByCode.set(code, perm.id);
    }
  }
  console.log(`  ✓ ${permissionIdByCode.size} permissions`);

  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { code: roleDef.code },
      update: { name: roleDef.name, description: roleDef.description },
      create: { code: roleDef.code, name: roleDef.name, description: roleDef.description, isSystem: true },
    });

    const permissionIds =
      roleDef.permissions[0] === "ALL"
        ? Array.from(permissionIdByCode.values())
        : roleDef.permissions.map((c) => permissionIdByCode.get(c)).filter((v): v is string => Boolean(v));

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      });
    }
  }
  console.log(`  ✓ ${ROLES.length} roles systeme`);

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@ndjamena.td";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const password = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
    const hashed = await bcrypt.hash(password, 12);
    const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { code: "SUPER_ADMIN" } });
    const dgs = await prisma.department.findUnique({ where: { code: "DGS" } });
    await prisma.user.create({
      data: {
        name: "Super Administrateur",
        email: adminEmail,
        password: hashed,
        mustResetPwd: true,
        organizationLevel: "CENTRAL",
        departmentId: dgs?.id,
        roles: { create: [{ roleId: superAdminRole.id }] },
      },
    });
    console.log("  ✓ Compte SUPER_ADMIN cree :");
    console.log(`      email    : ${adminEmail}`);
    console.log(`      password : ${password}`);
    console.log("    ⚠ A changer immediatement apres la premiere connexion.");
  } else {
    console.log("  · Compte SUPER_ADMIN deja present, inchange.");
  }

  console.log("Termine.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
