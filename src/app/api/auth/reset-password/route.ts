import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { validatePasswordStrength } from "@/lib/password-policy";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie." }, { status: 401 });

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  const password = body.password;
  if (!password) {
    return NextResponse.json({ error: "Mot de passe requis." }, { status: 400 });
  }
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed, mustResetPwd: false } });

  await logAudit({ user, action: "UPDATE", module: "auth", entityType: "User", entityId: user.id, newValue: { passwordReset: true } });

  return NextResponse.json({ ok: true });
}
