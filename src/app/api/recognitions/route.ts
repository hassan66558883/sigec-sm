import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listRecognitions, declareRecognition } from "@/lib/services/recognitions";

export async function GET() {
  try {
    const user = await requirePermission("recognitions", "view");
    const data = await listRecognitions(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("recognitions", "create");
    const body = await req.json();
    const created = await declareRecognition(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
