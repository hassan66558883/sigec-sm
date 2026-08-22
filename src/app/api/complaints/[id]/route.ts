import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { getComplaintForStaff, updateComplaintStatus, assignComplaint } from "@/lib/services/complaints";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const data = await getComplaintForStaff(user, id);
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
    if (body.action === "assign") {
      return NextResponse.json({ data: await assignComplaint(user, id, body.assignedToId) });
    }
    if (body.action === "update_status") {
      return NextResponse.json({ data: await updateComplaintStatus(user, id, body.status, body.note) });
    }
    throw new ApiError(400, "Action invalide.");
  } catch (error) {
    return handleApiError(error);
  }
}
