import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import {
  getComplaintForStaff,
  transitionComplaint,
  assignComplaintToDepartment,
  assignComplaintToAgent,
  requalifyComplaintPriority,
  escalateComplaint,
} from "@/lib/services/complaints";

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
    if (body.action === "assign_department") {
      return NextResponse.json({ data: await assignComplaintToDepartment(user, id, body.departmentId) });
    }
    if (body.action === "assign_agent") {
      return NextResponse.json({ data: await assignComplaintToAgent(user, id, body.agentUserId) });
    }
    if (body.action === "transition") {
      return NextResponse.json({
        data: await transitionComplaint(user, id, body.status, {
          note: body.note,
          rejectionReason: body.rejectionReason,
          resolutionNotes: body.resolutionNotes,
        }),
      });
    }
    if (body.action === "requalify_priority") {
      return NextResponse.json({ data: await requalifyComplaintPriority(user, id, body.priority) });
    }
    if (body.action === "escalate") {
      return NextResponse.json({ data: await escalateComplaint(user, id, body.toLevel, body.reason) });
    }
    throw new ApiError(400, "Action invalide.");
  } catch (error) {
    return handleApiError(error);
  }
}
