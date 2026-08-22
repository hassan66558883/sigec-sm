import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listCashRegisters, openCashRegister } from "@/lib/services/caisses";

export async function GET() {
  try {
    const user = await requirePermission("caisses", "view");
    const data = await listCashRegisters(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("caisses", "create");
    const body = await req.json();
    const created = await openCashRegister(user, body.agentId);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
