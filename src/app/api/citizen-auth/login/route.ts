import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createCitizenSessionToken, CITIZEN_SESSION_COOKIE, CITIZEN_SESSION_COOKIE_MAX_AGE } from "@/lib/citizen-auth";
import { isRateLimited } from "@/lib/rate-limit";
import { requestMeta } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { ipAddress } = requestMeta(req);
  if (isRateLimited(`citizen-login:${ipAddress ?? "unknown"}`)) {
    return NextResponse.json({ error: "Trop de tentatives. Reessayez dans quelques minutes." }, { status: 429 });
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

  const account = await prisma.citizenAccount.findUnique({ where: { email } });
  const passwordOk = account ? await bcrypt.compare(password, account.password) : false;
  if (!account || !passwordOk || !account.isActive) {
    return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
  }

  await prisma.citizenAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });

  const token = await createCitizenSessionToken({ sub: account.id, email: account.email });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CITIZEN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CITIZEN_SESSION_COOKIE_MAX_AGE,
  });
  return res;
}
