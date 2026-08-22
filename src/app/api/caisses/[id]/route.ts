import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { getCashRegister, closeCashRegister } from "@/lib/services/caisses";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const data = await getCashRegister(user, id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();
    if (body.action === "close") {
      return NextResponse.json({ data: await closeCashRegister(user, id, Number(body.declaredAmount)) });
    }
    throw new ApiError(400, "Action invalide.");
  } catch (error) {
    return handleApiError(error);
  }
}
