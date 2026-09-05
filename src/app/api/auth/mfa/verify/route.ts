import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, createSessionToken, SESSION_COOKIE, SESSION_COOKIE_MAX_AGE } from "@/lib/auth";
import { logAudit, requestMeta } from "@/lib/audit";
import { isRateLimited } from "@/lib/rate-limit";
import { verifyMfaCode } from "@/lib/services/mfa";

// 2e etape de connexion (module securite, section 2) : appelee une fois le
// mot de passe deja verifie (session emise avec mfaPending=true, voir
// api/auth/login). Un code TOTP fait 6 chiffres (10^6 combinaisons) — sans
// limite, une attaque par force brute deviendrait realiste sur la fenetre de
// validite de 30s ; meme fenetre/seuil que le formulaire de connexion
// (rate-limit.ts, valeurs par defaut).
export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = requestMeta(req);
  if (isRateLimited(`mfa-verify:${ipAddress ?? "unknown"}`)) {
    return NextResponse.json({ error: "Trop de tentatives. Reessayez dans quelques minutes." }, { status: 429 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  if (!user.mfaEnabled) return NextResponse.json({ error: "MFA non active sur ce compte." }, { status: 400 });

  // Deja verifie pour cette session : reponse idempotente plutot qu'une
  // erreur, au cas ou l'onglet du navigateur serait revenu en arriere.
  if (!user.mfaPending) return NextResponse.json({ ok: true });

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }
  const code = body.code?.trim();
  if (!code) return NextResponse.json({ error: "Code requis." }, { status: 400 });

  const ok = await verifyMfaCode(user.id, code);
  if (!ok) {
    await logAudit({
      user: { id: user.id, name: user.name },
      action: "MFA_FAILED",
      module: "auth",
      entityType: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
      result: "FAILURE",
    });
    return NextResponse.json({ error: "Code invalide." }, { status: 401 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAudit({
    user: { id: user.id, name: user.name },
    action: "LOGIN",
    module: "auth",
    entityType: "User",
    entityId: user.id,
    ipAddress,
    userAgent,
  });

  const token = await createSessionToken({ sub: user.id, name: user.name, email: user.email, mfaPending: false });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
  return res;
}
