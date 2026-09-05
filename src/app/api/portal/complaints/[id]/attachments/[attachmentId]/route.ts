import { NextResponse } from "next/server";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { ApiError, handleApiError } from "@/lib/api";
import { getComplaintAttachmentForCitizen } from "@/lib/services/complaints";
import { readAttachmentFile } from "@/lib/complaint-attachments";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    const account = await getCurrentCitizenAccount();
    if (!account) throw new ApiError(401, "Non authentifie.");
    const { id, attachmentId } = await params;
    const attachment = await getComplaintAttachmentForCitizen(account, id, attachmentId);
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
