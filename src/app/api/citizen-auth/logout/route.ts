import { NextResponse } from "next/server";
import { CITIZEN_SESSION_COOKIE } from "@/lib/citizen-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(CITIZEN_SESSION_COOKIE);
  return res;
}
