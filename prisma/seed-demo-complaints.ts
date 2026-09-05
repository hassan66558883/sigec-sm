// Jeu de donnees de demonstration pour le module Plaintes & Doleances
// (section 49 de l'instruction : "au moins 50 plaintes/doleances de test
// avec des statuts varies"). Volontairement SEPARE de prisma/seed.ts (qui
// tourne avant chaque suite de tests et a chaque `npm run db:seed`) : ce
// script cree des donnees de DEMONSTRATION (transactionnelles, volumineuses,
// jetables), pas des donnees de REFERENCE (roles/permissions/arrondissements)
// — les melanger aurait pollue chaque execution des tests avec 50 dossiers
// sans rapport avec ce qu'ils verifient.
//
// A executer manuellement : npm run db:seed:demo-complaints
// Idempotent par construction (verifie la presence du prefixe DEMO- avant
// de creer quoi que ce soit) — relancer ce script ne duplique jamais les
// donnees.
//
// Passe systematiquement par les VRAIES fonctions de service
// (submitComplaint/transitionComplaint/assignComplaint.../escalateComplaint/
// mergeComplaints/submitComplaintSatisfaction), jamais par des insertions
// Prisma directes avec un statut choisi a la main — la donnee de demo doit
// respecter exactement les memes invariants (machine a etats, SLA, journal
// d'audit) qu'une vraie utilisation, sans quoi elle serait trompeuse.
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import type { CurrentUser } from "../src/lib/auth";
import {
  submitComplaint,
  transitionComplaint,
  assignComplaintToDepartment,
  assignComplaintToAgent,
  escalateComplaint,
  mergeComplaints,
  submitComplaintSatisfaction,
} from "../src/lib/services/complaints";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CATEGORIES = ["VOIRIE", "PROPRETE", "ECLAIRAGE", "EAU", "SECURITE", "AUTRE"] as const;
const PRIORITIES = ["FAIBLE", "NORMAL"] as const; // le citoyen ne choisit jamais plus haut (section 8)

const DESCRIPTIONS: Record<(typeof CATEGORIES)[number], string[]> = {
  VOIRIE: [
    "Un grand nid de poule s'est forme sur la chaussee, dangereux pour les motos.",
    "La route est fortement degradee depuis les dernieres pluies, difficile a circuler.",
    "Le caniveau est bouche par des dechets et deborde a chaque pluie.",
  ],
  PROPRETE: [
    "Les ordures menageres ne sont plus collectees depuis plus d'une semaine.",
    "Une decharge sauvage s'est formee au coin de la rue, odeurs et insectes.",
    "Le marche du quartier est tres insalubre, aucun ramassage des dechets.",
  ],
  ECLAIRAGE: [
    "Le lampadaire devant chez moi ne fonctionne plus depuis deux semaines.",
    "Toute la rue est plongee dans le noir la nuit, plusieurs poteaux sont eteints.",
    "L'eclairage public du carrefour est en panne, tres dangereux pour les pietons.",
  ],
  EAU: [
    "Une fuite d'eau importante coule dans la rue depuis plusieurs jours.",
    "Coupure d'eau prolongee dans le quartier sans information de la SNE.",
    "Le robinet public du quartier est casse et laisse couler l'eau en continu.",
  ],
  SECURITE: [
    "Insecurite croissante la nuit dans le quartier, plusieurs vols signales.",
    "Absence totale d'eclairage public la nuit, favorise l'insecurite.",
    "Rassemblements bruyants et suspects chaque soir pres de l'ecole.",
  ],
  AUTRE: [
    "Nuisances sonores repetees d'un commerce qui depasse largement les horaires autorises.",
    "Occupation illegale du trottoir par des vendeurs, bloque le passage des pietons.",
    "Odeurs nauseabondes provenant d'un atelier voisin, gene le voisinage.",
  ],
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const already = await prisma.citizen.count({ where: { uniqueNumber: { startsWith: "DEMO-COMPLAINT-" } } });
  if (already > 0) {
    console.log(`Donnees de demo Plaintes & Doleances deja presentes (${already} citoyens DEMO-COMPLAINT-*) — rien a faire.`);
    await pool.end();
    return;
  }

  const arrondissements = await prisma.arrondissement.findMany({ orderBy: { number: "asc" } });
  if (arrondissements.length === 0) throw new Error("Aucun arrondissement — lancez d'abord `npm run db:seed`.");

  const password = await bcrypt.hash("Demo1234!", 10);

  // Un seul agent de demo, en portee CENTRALE : bypasse le controle
  // territorial (canAccessArrondissement) pour pouvoir faire avancer des
  // dossiers dans les 10 arrondissements sans creer 10 comptes distincts.
  const agentRole = await prisma.role.findUniqueOrThrow({ where: { code: "COMPLAINTS_AGENT" } });
  const supervisorRole = await prisma.role.findUniqueOrThrow({ where: { code: "COMPLAINTS_SUPERVISOR" } });
  const demoAgentUser = await prisma.user.create({
    data: {
      name: "Agent Demo Plaintes",
      email: "demo-agent-plaintes@sigec.local",
      password,
      organizationLevel: "CENTRAL",
      roles: { create: { roleId: agentRole.id } },
    },
  });
  const demoSupervisorUser = await prisma.user.create({
    data: {
      name: "Superviseur Demo Plaintes",
      email: "demo-superviseur-plaintes@sigec.local",
      password,
      organizationLevel: "CENTRAL",
      roles: { create: { roleId: supervisorRole.id } },
    },
  });
  const demoDepartment = await prisma.department.findFirst({ where: { isActive: true } });
  if (!demoDepartment) throw new Error("Aucun service actif — lancez d'abord `npm run db:seed`.");

  const staffActor: CurrentUser = {
    id: demoAgentUser.id,
    name: demoAgentUser.name,
    email: demoAgentUser.email,
    isActive: true,
    mustResetPwd: false,
    roles: [{ code: "COMPLAINTS_AGENT", name: "Agent plaintes" }],
    permissions: new Set([
      "complaints:view", "complaints:assign", "complaints:update",
      "complaints:resolve", "complaints:reject", "complaints:manage_categories", "complaints:export",
    ]),
    organizationLevel: "CENTRAL",
    hasGlobalScope: true,
    departmentId: null,
    arrondissementIds: [],
    quartierIds: [],
  };

  // 10 citoyens de demo, un par arrondissement, chacun deposant 5 dossiers (= 50).
  // Forme minimale attendue par submitComplaint() (voir CitizenAccountWithCitizen,
  // non exporte, dans services/complaints.ts) : {id, citizen:{arrondissementId}}.
  const citizenAccounts: { id: string; citizen: { arrondissementId: string } }[] = [];
  for (const arr of arrondissements) {
    const citizen = await prisma.citizen.create({
      data: {
        uniqueNumber: `DEMO-COMPLAINT-${arr.number}`,
        firstName: pick(["Amina", "Moussa", "Fatime", "Idriss", "Halime", "Ousmane", "Zara", "Brahim"]),
        lastName: pick(["Adoum", "Hassan", "Mahamat", "Youssouf", "Abakar", "Deby", "Kaya"]),
        sex: pick(["M", "F"] as const),
        arrondissementId: arr.id,
      },
    });
    const account = await prisma.citizenAccount.create({
      data: { citizenId: citizen.id, email: `demo-complaint-${arr.number}@sigec.local`, password },
      include: { citizen: true },
    });
    citizenAccounts.push(account);
  }

  const createdIds: string[] = [];
  let count = 0;
  for (const account of citizenAccounts) {
    const quartiers = await prisma.quartier.findMany({ where: { arrondissementId: account.citizen.arrondissementId }, take: 5 });
    for (let i = 0; i < 5; i++) {
      const category = pick(CATEGORIES);
      const complaint = await submitComplaint(account, {
        category,
        description: pick(DESCRIPTIONS[category]),
        priority: pick(PRIORITIES),
        quartierId: quartiers.length > 0 ? pick(quartiers).id : undefined,
      });
      createdIds.push(complaint.id);
      count++;

      // Distribution volontairement variee des statuts (section 49).
      const roll = Math.random();
      if (roll < 0.12) {
        // reste SUBMITTED
      } else if (roll < 0.20) {
        await transitionComplaint(staffActor, complaint.id, "RECEIVED");
      } else if (roll < 0.28) {
        await transitionComplaint(staffActor, complaint.id, "RECEIVED");
        await transitionComplaint(staffActor, complaint.id, "VERIFYING");
      } else if (roll < 0.34) {
        await transitionComplaint(staffActor, complaint.id, "RECEIVED");
        await transitionComplaint(staffActor, complaint.id, "VERIFYING");
        await transitionComplaint(staffActor, complaint.id, "NEEDS_INFO");
      } else if (roll < 0.42) {
        await transitionComplaint(staffActor, complaint.id, "RECEIVED");
        await transitionComplaint(staffActor, complaint.id, "VERIFYING");
        await transitionComplaint(staffActor, complaint.id, "REJECTED", { rejectionReason: "Hors competence municipale." });
      } else if (roll < 0.55) {
        await transitionComplaint(staffActor, complaint.id, "RECEIVED");
        await transitionComplaint(staffActor, complaint.id, "VERIFYING");
        await assignComplaintToDepartment(staffActor, complaint.id, demoDepartment.id);
        await assignComplaintToAgent(staffActor, complaint.id, demoAgentUser.id);
        // reste ASSIGNED_AGENT ou avance a IN_PROGRESS/WAITING
        if (Math.random() < 0.6) {
          await transitionComplaint(staffActor, complaint.id, "IN_PROGRESS");
          if (Math.random() < 0.3) await transitionComplaint(staffActor, complaint.id, "WAITING");
        }
      } else if (roll < 0.85) {
        await transitionComplaint(staffActor, complaint.id, "RECEIVED");
        await transitionComplaint(staffActor, complaint.id, "VERIFYING");
        await assignComplaintToDepartment(staffActor, complaint.id, demoDepartment.id);
        await assignComplaintToAgent(staffActor, complaint.id, demoAgentUser.id);
        await transitionComplaint(staffActor, complaint.id, "IN_PROGRESS");
        await transitionComplaint(staffActor, complaint.id, "RESOLVED", { resolutionNotes: "Intervention effectuee sur place." });
        if (Math.random() < 0.5) {
          await submitComplaintSatisfaction(account, complaint.id, {
            wasResolved: pick(["OUI", "PARTIEL"] as const),
            rating: Math.floor(Math.random() * 5) + 1,
            comment: "Merci pour l'intervention.",
          });
        }
        if (Math.random() < 0.4) {
          await transitionComplaint(staffActor, complaint.id, "VALIDATING");
          await transitionComplaint(staffActor, complaint.id, "CLOSED");
        }
      } else {
        // Escalade (5-6 dossiers) : trace un cas concret d'arbitrage.
        await transitionComplaint(staffActor, complaint.id, "RECEIVED");
        await transitionComplaint(staffActor, complaint.id, "VERIFYING");
        await escalateComplaint(staffActor, complaint.id, "SUPERVISOR", "Delai de traitement depasse.", demoSupervisorUser.id);
      }
    }
  }

  // Un exemple de doublon fusionne, pour la fonctionnalite de detection
  // (section 26) — mergeComplaints() ne verifie pas la similarite de
  // contenu (c'est le role de findSimilarComplaints(), separee), seulement
  // que les deux dossiers existent et ne sont pas deja fusionnes.
  if (createdIds.length >= 2) {
    await mergeComplaints(staffActor, createdIds[0], createdIds[1]);
  }

  console.log(`Termine — ${count} plaintes de demonstration creees (statuts varies, escalades vers un superviseur nomme, 1 fusion).`);
  console.log("Comptes de demo : demo-agent-plaintes@sigec.local / demo-superviseur-plaintes@sigec.local (mot de passe Demo1234!).");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
