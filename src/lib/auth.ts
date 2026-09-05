import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "sigec_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8; // 8 heures

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET n'est pas defini.");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string; // userId
  name: string;
  email: string;
  // Vrai entre un mot de passe verifie et un code MFA verifie (module
  // securite, section 2) — porte par le JWT lui-meme (propriete de CETTE
  // session/connexion), jamais recalcule depuis user.mfaEnabled : sinon un
  // utilisateur ayant deja franchi le second facteur devrait le refaire a
  // chaque requete tant que le MFA reste active sur son compte. Absent (donc
  // falsy) pour tout compte sans MFA active.
  mfaPending?: boolean;
};

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }
    return { sub: payload.sub, name: payload.name, email: payload.email, mfaPending: payload.mfaPending === true };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_MAX_AGE = SESSION_DURATION_SECONDS;

// Identite complete de l'utilisateur courant (session + roles + permissions +
// perimetre territorial), pour les Server Components / route handlers.
// Ne PAS utiliser dans le middleware (Edge runtime, pas d'acces Prisma) :
// le middleware ne fait qu'une verification de session legere.
export type OrganizationLevel = "CENTRAL" | "ARRONDISSEMENT";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  mustResetPwd: boolean;
  mfaEnabled: boolean;
  mfaPending: boolean;
  roles: { code: string; name: string }[];
  permissions: Set<string>; // "<module>:<action>"
  organizationLevel: OrganizationLevel;
  hasGlobalScope: boolean; // derive de organizationLevel === "CENTRAL"
  departmentId: string | null;
  arrondissementIds: string[];
  quartierIds: string[];
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      arrondissements: true,
      quartiers: true,
    },
  });
  if (!user || !user.isActive) return null;

  const permissions = new Set<string>();
  for (const ur of user.roles) {
    for (const rp of ur.role.permissions) permissions.add(rp.permission.code);
  }

  const organizationLevel = (user.organizationLevel === "CENTRAL" ? "CENTRAL" : "ARRONDISSEMENT") as OrganizationLevel;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    mustResetPwd: user.mustResetPwd,
    mfaEnabled: user.mfaEnabled,
    mfaPending: session.mfaPending === true,
    roles: user.roles.map((ur) => ({ code: ur.role.code, name: ur.role.name })),
    permissions,
    organizationLevel,
    hasGlobalScope: organizationLevel === "CENTRAL",
    departmentId: user.departmentId,
    arrondissementIds: user.arrondissements.map((a) => a.arrondissementId),
    quartierIds: user.quartiers.map((q) => q.quartierId),
  };
}

// Roles rattaches par defaut au niveau CENTRAL (Mairie Centrale) lors du
// seed. N'est PAS utilise pour l'autorisation en cours de session : la
// source de verite est user.organizationLevel (voir CurrentUser ci-dessus).
export const CENTRAL_ROLE_CODES = new Set(["SUPER_ADMIN", "MUNICIPAL_ADMIN", "MAYOR", "AUDITOR"]);
