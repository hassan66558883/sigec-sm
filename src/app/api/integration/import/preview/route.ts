import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import { previewImport } from "@/lib/services/integration-import";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const body = await req.json();
    if (!body.mappingId || !body.csvContent || !body.fileName) throw new ApiError(400, "mappingId, csvContent et fileName sont requis.");
    const result = await previewImport(user, { mappingId: body.mappingId, csvContent: body.csvContent, fileName: body.fileName });
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
