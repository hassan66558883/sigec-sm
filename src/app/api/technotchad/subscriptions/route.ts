import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listTechnoSubscriptions, createTechnoSubscription } from "@/lib/services/technotchad";

export async function GET() {
  try {
    const user = await requirePermission("technotchad_subscriptions", "view");
    const data = await listTechnoSubscriptions(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("technotchad_subscriptions", "create");
    const body = await req.json();
    const created = await createTechnoSubscription(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
