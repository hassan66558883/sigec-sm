import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { decryptField } from "@/lib/encryption";

// Realm d'authentification separe des comptes agents (lib/auth.ts) : un
// citoyen n'a aucune permission RBAC, uniquement acces a ses propres
// donnees (portail public, section 15).
export const CITIZEN_SESSION_COOKIE = "sigec_citizen_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET n'est pas defini.");
  return new TextEncoder().encode(secret);
}

export type CitizenSessionPayload = {
  sub: string; // citizenAccountId
  email: string;
};

export async function createCitizenSessionToken(payload: CitizenSessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyCitizenSessionToken(token: string): Promise<CitizenSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export const CITIZEN_SESSION_COOKIE_MAX_AGE = SESSION_DURATION_SECONDS;

export async function getCurrentCitizenAccount() {
  const store = await cookies();
  const token = store.get(CITIZEN_SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyCitizenSessionToken(token);
  if (!session) return null;

  const account = await prisma.citizenAccount.findUnique({
    where: { id: session.sub },
    include: { citizen: { include: { arrondissement: true } } },
  });
  if (!account || !account.isActive) return null;
  // Choix unique de dechiffrement pour tout le portail citoyen : chaque
  // page/service qui appelle getCurrentCitizenAccount() recoit deja un
  // numero en clair, sans avoir a connaitre le detail du chiffrement.
  return { ...account, citizen: { ...account.citizen, phone: decryptField(account.citizen.phone) } };
}
