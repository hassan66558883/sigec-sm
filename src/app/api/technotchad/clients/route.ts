import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listTechnoClients, createTechnoClient } from "@/lib/services/technotchad";

export async function GET() {
  try {
    const user = await requirePermission("technotchad_clients", "view");
    const data = await listTechnoClients(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("technotchad_clients", "create");
    const body = await req.json();
    const created = await createTechnoClient(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
