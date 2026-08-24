// Seed Phase 1 : ville de N'Djamena, 10 arrondissements (placeholders a valider
// par la mairie), permissions granulaires, roles systeme (section 18 du cahier
// des charges) et un compte SUPER_ADMIN initial.
//
// IMPORTANT : les noms d'arrondissements ci-dessous sont des placeholders
// numerotes ("1er/2e/... Arrondissement"). Les quartiers (QUARTIERS_NDJAMENA)
// viennent d'une liste de travail fournie par l'utilisateur, marquee
// sourceReference="a valider" a la creation. Conformement a la regle 39 du
// cahier des charges, aucune denomination officielle n'est inventee ici — a
// confirmer par l'administration via /admin/arrondissements une fois les
// denominations officielles validees.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateLicenseKey } from "../src/lib/ids";

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
  payments: ["view", "create", "export", "cancel", "refund"],
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

// Permissions commerciales de l'editeur TECHNOTCHAD (gestion des abonnements
// et licences) — deliberement dans un objet SEPARE de MODULES_ACTIONS et
// prefixees "technotchad_" : ce prefixe est ce qui permet de les EXCLURE de
// l'expansion du role municipal SUPER_ADMIN (voir TECHNOTCHAD_PERMISSION_PREFIX
// plus bas, regle 23 du cahier des charges — un administrateur municipal ne
// doit jamais heriter automatiquement des donnees commerciales de l'editeur).
const TECHNOTCHAD_MODULES_ACTIONS: Record<string, string[]> = {
  technotchad_clients: ["view", "create", "edit", "delete"],
  technotchad_products: ["view", "create", "edit"],
  technotchad_plans: ["view", "create", "edit"],
  technotchad_contracts: ["view", "create", "edit"],
  technotchad_subscriptions: ["view", "create", "edit", "suspend", "terminate"],
  technotchad_licenses: ["view", "create", "revoke"],
  technotchad_billing: ["view"],
  technotchad_audit: ["view", "export"],
  technotchad_settings: ["view", "edit"],
};

const TECHNOTCHAD_PERMISSION_PREFIX = "technotchad_";

// Modules activables du produit SIGEC-SM cote TECHNOTCHAD (miroir commercial
// des phases fonctionnelles de l'application — pas les memes codes que
// MODULES_ACTIONS, qui sont des permissions RBAC internes a l'application).
const SIGEC_SM_PRODUCT_MODULES = [
  { code: "CIVIL_STATUS", name: "Etat civil" },
  { code: "CITIZEN_REGISTRATION", name: "Enregistrement des citoyens" },
  { code: "RESIDENCE_CERTIFICATE", name: "Certificats de residence" },
  { code: "MARKETS", name: "Marches municipaux" },
  { code: "SHOPS", name: "Boutiques et commerces" },
  { code: "MUNICIPAL_TAX", name: "Taxes municipales" },
  { code: "REVENUE", name: "Recettes municipales" },
  { code: "COLLECTION_AGENTS", name: "Agents collecteurs" },
  { code: "MOBILE_MONEY", name: "Mobile Money" },
  { code: "COMPLAINTS", name: "Plaintes et doleances" },
  { code: "STATISTICS", name: "Statistiques et tableaux de bord" },
  { code: "LAND_MANAGEMENT", name: "Gestion fonciere" },
  { code: "DOCUMENT_MANAGEMENT", name: "Gestion documentaire" },
  { code: "CITIZEN_PORTAL", name: "Portail citoyen" },
  { code: "QR_VERIFICATION", name: "Verification par QR code" },
  { code: "REPORTING", name: "Rapports et exports" },
];

// Liste de travail des quartiers de N'Djamena, fournie par l'utilisateur —
// marquee "a valider" (voir sourceReference applique a la creation, regle
// 39 : jamais presentee comme une denomination officielle confirmee).
const QUARTIERS_NDJAMENA: { code: string; name: string; arrondissement: number }[] = [
  { code: "Q01-001", name: "Farcha", arrondissement: 1 },
  { code: "Q01-002", name: "Milezi", arrondissement: 1 },
  { code: "Q01-003", name: "Madjorio", arrondissement: 1 },
  { code: "Q01-004", name: "Guilmeye", arrondissement: 1 },
  { code: "Q01-005", name: "Djougoulier", arrondissement: 1 },
  { code: "Q01-006", name: "Karkandjeri", arrondissement: 1 },
  { code: "Q01-007", name: "Amsinéné", arrondissement: 1 },
  { code: "Q01-008", name: "Guinébor", arrondissement: 1 },
  { code: "Q01-009", name: "N'Djamena-Koudou", arrondissement: 1 },
  { code: "Q01-010", name: "Massil Abcoma", arrondissement: 1 },
  { code: "Q01-011", name: "Zaraf", arrondissement: 1 },
  { code: "Q01-012", name: "Allaya", arrondissement: 1 },
  { code: "Q01-013", name: "Ardeb-Timan", arrondissement: 1 },
  { code: "Q01-014", name: "Antona", arrondissement: 1 },

  { code: "Q02-001", name: "Djamba Ngato", arrondissement: 2 },
  { code: "Q02-002", name: "Mardjandaffack", arrondissement: 2 },
  { code: "Q02-003", name: "Bololo", arrondissement: 2 },
  { code: "Q02-004", name: "Goudji", arrondissement: 2 },
  { code: "Q02-005", name: "Klémat", arrondissement: 2 },

  { code: "Q03-001", name: "Gardolé", arrondissement: 3 },
  { code: "Q03-002", name: "Ambassatna", arrondissement: 3 },
  { code: "Q03-003", name: "Ardep Djoumal", arrondissement: 3 },
  { code: "Q03-004", name: "Sabangali", arrondissement: 3 },
  { code: "Q03-005", name: "Kabalaye", arrondissement: 3 },
  { code: "Q03-006", name: "Djambalbarh", arrondissement: 3 },

  { code: "Q04-001", name: "Repos I", arrondissement: 4 },
  { code: "Q04-002", name: "Repos II", arrondissement: 4 },
  { code: "Q04-003", name: "Naga I", arrondissement: 4 },
  { code: "Q04-004", name: "Naga II", arrondissement: 4 },
  { code: "Q04-005", name: "Blabine", arrondissement: 4 },

  { code: "Q05-001", name: "Ridina", arrondissement: 5 },
  { code: "Q05-002", name: "Am-Riguebé", arrondissement: 5 },
  { code: "Q05-003", name: "Karkandjie", arrondissement: 5 },

  { code: "Q06-001", name: "Moursal", arrondissement: 6 },
  { code: "Q06-002", name: "Paris-Congo", arrondissement: 6 },

  { code: "Q07-001", name: "Chagoua", arrondissement: 7 },
  { code: "Q07-002", name: "Dembé", arrondissement: 7 },
  { code: "Q07-003", name: "Ambatta", arrondissement: 7 },
  { code: "Q07-004", name: "Boutalbagara", arrondissement: 7 },
  { code: "Q07-005", name: "Kourmanadji", arrondissement: 7 },
  { code: "Q07-006", name: "Atrone", arrondissement: 7 },
  { code: "Q07-007", name: "Amtoukoui", arrondissement: 7 },
  { code: "Q07-008", name: "Amtoukoui Alaya", arrondissement: 7 },
  { code: "Q07-009", name: "Habena", arrondissement: 7 },
  { code: "Q07-010", name: "Gassi", arrondissement: 7 },
  { code: "Q07-011", name: "Kilwiti", arrondissement: 7 },
  { code: "Q07-012", name: "Ambatta 2", arrondissement: 7 },
  { code: "Q07-013", name: "Dembé 2", arrondissement: 7 },
  { code: "Q07-014", name: "Karkouta", arrondissement: 7 },
  { code: "Q07-015", name: "Djinio", arrondissement: 7 },

  { code: "Q08-001", name: "Diguel", arrondissement: 8 },
  { code: "Q08-002", name: "Ndjari", arrondissement: 8 },
  { code: "Q08-003", name: "Angabo", arrondissement: 8 },
  { code: "Q08-004", name: "Zaffaye-Est", arrondissement: 8 },
  { code: "Q08-005", name: "Zaffaye-Ouest", arrondissement: 8 },
  { code: "Q08-006", name: "Machaga", arrondissement: 8 },
  { code: "Q08-007", name: "Amtoukougne Koudou", arrondissement: 8 },

  { code: "Q09-001", name: "Walia", arrondissement: 9 },
  { code: "Q09-002", name: "Ngoumna", arrondissement: 9 },
  { code: "Q09-003", name: "Digangali", arrondissement: 9 },
  { code: "Q09-004", name: "Ngueli", arrondissement: 9 },
  { code: "Q09-005", name: "Kabé", arrondissement: 9 },
  { code: "Q09-006", name: "Toukra", arrondissement: 9 },
  { code: "Q09-007", name: "Gardolé 2", arrondissement: 9 },
  { code: "Q09-008", name: "Toukra Massa", arrondissement: 9 },

  { code: "Q10-001", name: "Gozator", arrondissement: 10 },
  { code: "Q10-002", name: "Goudji-Charffa", arrondissement: 10 },
  { code: "Q10-003", name: "Ouroula", arrondissement: 10 },
  { code: "Q10-004", name: "Gaoui", arrondissement: 10 },
  { code: "Q10-005", name: "Lamadji", arrondissement: 10 },
  { code: "Q10-006", name: "Sadjeri", arrondissement: 10 },
  { code: "Q10-007", name: "Achawayil", arrondissement: 10 },
  { code: "Q10-008", name: "Fondoré", arrondissement: 10 },
  { code: "Q10-009", name: "Djaballiro", arrondissement: 10 },
  { code: "Q10-010", name: "Hillé Houdjaj", arrondissement: 10 },
  { code: "Q10-011", name: "Tamon Kessa", arrondissement: 10 },
  { code: "Q10-012", name: "Wouroulou", arrondissement: 10 },
  { code: "Q10-013", name: "Kalatchou Sadjéré", arrondissement: 10 },
];

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
      "payments:view", "payments:create", "payments:export", "payments:cancel", "payments:refund",
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
      "payments:view", "payments:create", "payments:export", "payments:cancel", "payments:refund",
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
  // Roles TECHNOTCHAD (editeur) — jamais de permissions municipales SIGEC-SM,
  // jamais de scoping territorial. Isolation stricte vis-a-vis des roles
  // municipaux ci-dessus (regle 23).
  {
    code: "TECHNOTCHAD_SUPER_ADMIN",
    name: "TECHNOTCHAD — Super Administrateur",
    description: "Acces complet a la gestion des abonnements et licences TECHNOTCHAD (tous clients/produits).",
    permissions: Object.entries(TECHNOTCHAD_MODULES_ACTIONS).flatMap(([module, actions]) =>
      actions.map((action) => `${module}:${action}`)
    ),
  },
  {
    code: "TECHNOTCHAD_ADMIN",
    name: "TECHNOTCHAD — Administrateur",
    description: "Gestion operationnelle des clients, produits, plans, contrats, abonnements et licences.",
    permissions: [
      "technotchad_clients:view", "technotchad_clients:create", "technotchad_clients:edit",
      "technotchad_products:view", "technotchad_products:create", "technotchad_products:edit",
      "technotchad_plans:view", "technotchad_plans:create", "technotchad_plans:edit",
      "technotchad_contracts:view", "technotchad_contracts:create", "technotchad_contracts:edit",
      "technotchad_subscriptions:view", "technotchad_subscriptions:create", "technotchad_subscriptions:edit", "technotchad_subscriptions:suspend",
      "technotchad_licenses:view", "technotchad_licenses:create", "technotchad_licenses:revoke",
      "technotchad_billing:view",
      "technotchad_audit:view",
    ],
  },
  {
    code: "TECHNOTCHAD_FINANCE",
    name: "TECHNOTCHAD — Finance",
    description: "Suivi commercial et facturation (lecture des clients/contrats/abonnements, facturation).",
    permissions: [
      "technotchad_clients:view",
      "technotchad_contracts:view",
      "technotchad_subscriptions:view",
      "technotchad_billing:view",
    ],
  },
  {
    code: "TECHNOTCHAD_SUPPORT",
    name: "TECHNOTCHAD — Support",
    description: "Consultation des clients, abonnements et licences pour le support technique.",
    permissions: [
      "technotchad_clients:view",
      "technotchad_subscriptions:view",
      "technotchad_licenses:view",
    ],
  },
];

async function main() {
  console.log("Seed SIGEC-SM — Phase 1 (fondation)");

  const city = await prisma.city.upsert({
    where: { code: "NDJ" },
    update: {},
    create: { name: "N'Djamena", code: "NDJ" },
  });

  const arrondissementByNumber = new Map<number, string>();
  for (let number = 1; number <= 10; number++) {
    const code = `NDJ-${String(number).padStart(2, "0")}`;
    const name = `${number}${number === 1 ? "er" : "e"} Arrondissement`;
    const arrondissement = await prisma.arrondissement.upsert({
      where: { code },
      update: { name },
      create: { cityId: city.id, number, name, code },
    });
    arrondissementByNumber.set(number, arrondissement.id);
  }
  console.log("  ✓ Ville de N'Djamena et 10 arrondissements");

  const QUARTIER_SOURCE = "Liste de travail SIGEC-SM — a valider par la Mairie de N'Djamena";
  for (const q of QUARTIERS_NDJAMENA) {
    const arrondissementId = arrondissementByNumber.get(q.arrondissement);
    if (!arrondissementId) continue;
    await prisma.quartier.upsert({
      where: { code: q.code },
      update: { name: q.name, arrondissementId, sourceReference: QUARTIER_SOURCE },
      create: { code: q.code, name: q.name, arrondissementId, sourceReference: QUARTIER_SOURCE },
    });
  }
  console.log(`  ✓ ${QUARTIERS_NDJAMENA.length} quartiers (liste de travail — a valider)`);

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
  console.log(`  ✓ ${permissionIdByCode.size} permissions (municipales)`);

  for (const [module, actions] of Object.entries(TECHNOTCHAD_MODULES_ACTIONS)) {
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
  console.log(`  ✓ ${Object.values(TECHNOTCHAD_MODULES_ACTIONS).flat().length} permissions (TECHNOTCHAD)`);

  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { code: roleDef.code },
      update: { name: roleDef.name, description: roleDef.description },
      create: { code: roleDef.code, name: roleDef.name, description: roleDef.description, isSystem: true },
    });

    // "ALL" n'est utilise que par le SUPER_ADMIN municipal : il doit s'etendre
    // a tous les modules SIGEC-SM mais JAMAIS aux permissions technotchad_*
    // (donnees commerciales de l'editeur, regle 23 — separation stricte
    // municipal/commercial). Sans cette exclusion, ajouter des permissions
    // technotchad_* les accorderait automatiquement au super-admin municipal.
    const permissionIds =
      roleDef.permissions[0] === "ALL"
        ? Array.from(permissionIdByCode.entries())
            .filter(([code]) => !code.startsWith(TECHNOTCHAD_PERMISSION_PREFIX))
            .map(([, id]) => id)
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

  // -- TECHNOTCHAD : produit SIGEC-SM + client reel Ville de N'Djamena -----
  // Donnee commerciale reelle (le seul client actuel), pas un jeu de test —
  // codes fixes (pas d'entropie aleatoire) pour rester idempotent au reseed,
  // comme les autres referentiels de ce fichier.
  const product = await prisma.technoProduct.upsert({
    where: { productCode: "SIGEC-SM" },
    update: {},
    create: {
      productCode: "SIGEC-SM",
      name: "SIGEC-SM",
      description: "Systeme Integre de Gestion de l'Etat Civil et des Services Municipaux.",
      version: "1.0",
      productType: "ERP_MUNICIPAL",
      status: "ACTIVE",
    },
  });

  const productModuleById = new Map<string, string>();
  for (const m of SIGEC_SM_PRODUCT_MODULES) {
    const pm = await prisma.technoProductModule.upsert({
      where: { productId_moduleCode: { productId: product.id, moduleCode: m.code } },
      update: { name: m.name },
      create: { productId: product.id, moduleCode: m.code, name: m.name },
    });
    productModuleById.set(m.code, pm.id);
  }
  console.log(`  ✓ Produit TECHNOTCHAD "SIGEC-SM" et ${SIGEC_SM_PRODUCT_MODULES.length} modules`);

  let client = await prisma.technoClient.findFirst({ where: { clientCode: "TECH-CLI-000001" } });
  if (!client) {
    client = await prisma.technoClient.create({
      data: {
        clientCode: "TECH-CLI-000001",
        legalName: "Ville de N'Djamena",
        commercialName: "Mairie Centrale de N'Djamena",
        clientType: "MAIRIE",
        country: "Tchad",
        city: "N'Djamena",
        status: "ACTIVE",
      },
    });
  }

  const plan = await prisma.technoSubscriptionPlan.upsert({
    where: { productId_planCode: { productId: product.id, planCode: "SIGEC-SM-GOUVERNEMENTAL" } },
    update: {},
    create: {
      productId: product.id,
      planCode: "SIGEC-SM-GOUVERNEMENTAL",
      name: "SIGEC-SM — Plan Gouvernemental",
      billingPeriod: "ANNUAL",
      price: 0, // Placeholder — a valider avec la Mairie / la direction TECHNOTCHAD (facturation hors perimetre de cette phase).
      currency: "XAF",
      maxSites: 11,
      gracePeriodDays: 30,
      autoRenew: true,
      status: "ACTIVE",
    },
  });

  let contract = await prisma.technoContract.findFirst({ where: { contractNumber: "CTR-2026-00000001" } });
  if (!contract) {
    contract = await prisma.technoContract.create({
      data: {
        contractNumber: "CTR-2026-00000001",
        clientId: client.id,
        productId: product.id,
        contractTitle: "Contrat de licence SIGEC-SM — Ville de N'Djamena",
        startDate: new Date(),
        renewalType: "MANUAL",
        status: "ACTIVE",
      },
    });
  }

  let subscription = await prisma.technoSubscription.findFirst({ where: { subscriptionNumber: "SUB-2026-00000001" } });
  if (!subscription) {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    subscription = await prisma.technoSubscription.create({
      data: {
        subscriptionNumber: "SUB-2026-00000001",
        clientId: client.id,
        productId: product.id,
        planId: plan.id,
        contractId: contract.id,
        startDate,
        endDate,
        amount: plan.price,
        currency: plan.currency,
        status: "ACTIVE",
        autoRenew: true,
      },
    });

    await prisma.technoSubscriptionModule.createMany({
      data: Array.from(productModuleById.values()).map((moduleId) => ({
        subscriptionId: subscription!.id,
        moduleId,
        enabled: true,
      })),
    });

    const sites = ["Mairie Centrale", ...Array.from({ length: 10 }, (_, i) => `${i + 1}${i === 0 ? "er" : "e"} Arrondissement`)];
    await prisma.technoSubscriptionSite.createMany({
      data: sites.map((siteName, i) => ({
        subscriptionId: subscription!.id,
        clientId: client!.id,
        siteName,
        siteCode: i === 0 ? "SITE-MC" : `SITE-A${String(i).padStart(2, "0")}`,
      })),
    });

    await prisma.technoLicense.create({
      data: {
        licenseKey: generateLicenseKey("SIGEC-SM"),
        subscriptionId: subscription.id,
        clientId: client.id,
        productId: product.id,
        licenseType: "GOVERNMENT",
        activatedAt: startDate,
        expiresAt: endDate,
        maxSites: 11,
        status: "ACTIVE",
      },
    });

    console.log("  ✓ Abonnement TECHNOTCHAD, licence, modules et sites crees pour Ville de N'Djamena");
  } else {
    console.log("  · Abonnement TECHNOTCHAD deja present pour Ville de N'Djamena, inchange.");
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
