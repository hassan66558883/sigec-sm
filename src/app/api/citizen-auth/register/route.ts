import { NextRequest, NextResponse } from "next/server";
import { registerCitizenAccount } from "@/lib/services/citizen-portal";
import { handleApiError } from "@/lib/api";
import { isRateLimited } from "@/lib/rate-limit";
import { requestMeta } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { ipAddress } = requestMeta(req);
  if (isRateLimited(`citizen-register:${ipAddress ?? "unknown"}`)) {
    return NextResponse.json({ error: "Trop de tentatives. Reessayez dans quelques minutes." }, { status: 429 });
  }

  try {
    const body = await req.json();
    await registerCitizenAccount(body);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
