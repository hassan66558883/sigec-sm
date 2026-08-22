import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";

export async function POST(req: NextRequest) {
  const account = await getCurrentCitizenAccount();
  if (!account) return NextResponse.json({ error: "Non authentifie." }, { status: 401 });

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  const password = body.password;
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Mot de passe d'au moins 8 caracteres requis." }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.citizenAccount.update({ where: { id: account.id }, data: { password: hashed } });

  return NextResponse.json({ ok: true });
}
