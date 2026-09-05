import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { addComplaintAttachmentAsStaff, assertCanAttachToComplaintAsStaff } from "@/lib/services/complaints";
import { saveAttachmentFile } from "@/lib/complaint-attachments";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;

    // Verifie AVANT d'ecrire quoi que ce soit sur disque.
    await assertCanAttachToComplaintAsStaff(user, id);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Fichier requis.");

    const saved = await saveAttachmentFile(id, file);
    const data = await addComplaintAttachmentAsStaff(user, id, saved);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
