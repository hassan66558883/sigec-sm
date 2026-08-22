import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    await logAudit({ user, action: "LOGOUT", module: "auth", entityType: "User", entityId: user.id });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
