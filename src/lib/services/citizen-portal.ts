import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterCitizenInput = {
  uniqueNumber: string;
  lastName: string;
  email: string;
  password: string;
};

// Creation de compte par rattachement a un dossier citoyen EXISTANT
// (numero unique + nom), pas par simple auto-declaration — le dossier
// citoyen fait foi, cree par un agent d'etat civil lors d'un acte reel.
export async function registerCitizenAccount(input: RegisterCitizenInput) {
  const uniqueNumber = input.uniqueNumber?.trim().toUpperCase();
  const lastName = input.lastName?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!uniqueNumber || !lastName || !email || !EMAIL_RE.test(email)) {
    throw new ApiError(400, "Numero de dossier, nom et email valides requis.");
  }
  if (!input.password || input.password.length < 8) {
    throw new ApiError(400, "Mot de passe d'au moins 8 caracteres requis.");
  }

  const citizen = await prisma.citizen.findUnique({ where: { uniqueNumber } });
  if (!citizen || citizen.lastName.toLowerCase() !== lastName.toLowerCase()) {
    throw new ApiError(404, "Aucun dossier citoyen ne correspond a ces informations.");
  }

  const existingForCitizen = await prisma.citizenAccount.findUnique({ where: { citizenId: citizen.id } });
  if (existingForCitizen) throw new ApiError(409, "Un compte existe deja pour ce dossier citoyen.");

  const existingEmail = await prisma.citizenAccount.findUnique({ where: { email } });
  if (existingEmail) throw new ApiError(409, "Cet email est deja utilise.");

  const hashed = await bcrypt.hash(input.password, 12);
  const account = await prisma.citizenAccount.create({
    data: { citizenId: citizen.id, email, password: hashed },
  });

  // user: null — voir online-payments.ts pour la convention (AuditLog.userId
  // ne peut pas referencer un CitizenAccount). Un compte portail donne acces
  // aux propres donnees du citoyen : action sensible, jusqu'ici sans aucune
  // trace d'audit (voir audit 2026-09-04).
  await logAudit({
    user: null,
    action: "REGISTER",
    module: "citizen_portal",
    entityType: "CitizenAccount",
    entityId: account.id,
    arrondissementId: citizen.arrondissementId,
    newValue: { email, citizenId: citizen.id, citizenUniqueNumber: uniqueNumber },
  });

  return account;
}
