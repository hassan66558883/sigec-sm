import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { getComplaintAttachmentForStaff } from "@/lib/services/complaints";
import { readAttachmentFile } from "@/lib/complaint-attachments";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id, attachmentId } = await params;
    const attachment = await getComplaintAttachmentForStaff(user, id, attachmentId);
    const buffer = await readAttachmentFile(attachment.storagePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Cache-Control": "private, max-age=0, no-cache",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
