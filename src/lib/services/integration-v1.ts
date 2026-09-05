import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";

// Services dedies aux endpoints /api/v1/* (Integration & Interoperability
// Center) — DISTINCTS des services utilises par l'interface d'administration
// (ex. services/citizens.ts), qui renvoient des objets complets (avec
// relations, champs dechiffres) a un agent deja authentifie et scope par
// arrondissement. Un systeme externe n'a ni perimetre territorial ni besoin
// des champs complets : les reponses ici sont volontairement minimales
// (section 41 — "limiter les donnees partagees a ce qui est strictement
// necessaire").

const CITIZEN_SELECT = {
  id: true,
  uniqueNumber: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  sex: true,
  arrondissementId: true,
  isDeceased: true,
} as const;

const PAGE_SIZE = 50;

export async function listCitizensForIntegration(page = 1) {
  const [rows, total] = await Promise.all([
    prisma.citizen.findMany({
      select: CITIZEN_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.citizen.count(),
  ]);
  return { data: rows, page, pageSize: PAGE_SIZE, total };
}

export async function getCitizenForIntegration(id: string) {
  const citizen = await prisma.citizen.findUnique({ where: { id }, select: CITIZEN_SELECT });
  if (!citizen) throw new ApiError(404, "Citoyen introuvable.");
  return citizen;
}
