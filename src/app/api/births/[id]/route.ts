import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { getBirthRecord, validateBirthRecord, annulBirthRecord } from "@/lib/services/births";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const data = await getBirthRecord(user, id);
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
    if (body.action === "validate") {
      return NextResponse.json({ data: await validateBirthRecord(user, id) });
    }
    if (body.action === "revoke") {
      return NextResponse.json({ data: await annulBirthRecord(user, id, body.reason) });
    }
    throw new ApiError(400, "Action invalide.");
  } catch (error) {
    return handleApiError(error);
  }
}
