import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_MAX_AGE } from "@/lib/auth";
import { logAudit, requestMeta } from "@/lib/audit";
import { isRateLimited } from "@/lib/rate-limit";
import { recordLoginAttempt, isAccountLocked } from "@/lib/services/login-security";

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = requestMeta(req);
  const rateLimitKey = `login:${ipAddress ?? "unknown"}`;

  if (isRateLimited(rateLimitKey)) {
    await logAudit({
      user: null,
      action: "LOGIN_FAILED",
      module: "auth",
      ipAddress,
      userAgent,
      result: "FAILURE",
      newValue: { reason: "rate_limited" },
    });
    return NextResponse.json(
      { error: "Trop de tentatives. Reessayez dans quelques minutes." },
      { status: 429 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
  }

  // Verrouillage de compte (module securite, section 2) : par email, pas
  // par IP — distinct du rate-limit ci-dessus, qui ne protege pas contre
  // une attaque distribuee sur un seul compte depuis plusieurs adresses.
  // Verifie AVANT bcrypt.compare (aucune verification de mot de passe
  // tentee sur un compte deja verrouille).
  if (await isAccountLocked(email)) {
    await logAudit({
      user: null,
      action: "LOGIN_FAILED",
      module: "auth",
      entityType: "User",
      ipAddress,
      userAgent,
      result: "FAILURE",
      newValue: { email, reason: "account_locked" },
    });
    return NextResponse.json({ error: "Compte temporairement verrouille suite a des echecs de connexion repetes. Reessayez plus tard." }, { status: 423 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = user ? await bcrypt.compare(password, user.password) : false;

  if (!user || !passwordOk || !user.isActive) {
    await recordLoginAttempt(email, ipAddress, userAgent, false);
    await logAudit({
      user: null,
      action: "LOGIN_FAILED",
      module: "auth",
      entityType: "User",
      entityId: user?.id,
      ipAddress,
      userAgent,
      result: "FAILURE",
      newValue: { email },
    });
    return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
  }

  await recordLoginAttempt(email, ipAddress, userAgent, true);
  const token = await createSessionToken({ sub: user.id, name: user.name, email: user.email });

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
