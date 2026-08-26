import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/translate";

// Changement de langue : pas de RBAC ici (aucune donnee sensible), la seule
// contrainte est de n'accepter qu'une langue reellement supportee.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isLocale(body.locale)) {
    return NextResponse.json({ error: "Langue non supportee." }, { status: 400 });
  }
  const store = await cookies();
  store.set(LOCALE_COOKIE, body.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return NextResponse.json({ locale: body.locale });
}
