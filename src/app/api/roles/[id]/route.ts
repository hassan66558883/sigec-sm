import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { setRolePermissions } from "@/lib/services/roles";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("roles", "edit");
    const { id } = await params;
    const body = await req.json();
    const updated = await setRolePermissions(user, id, Array.isArray(body.permissionIds) ? body.permissionIds : []);
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
