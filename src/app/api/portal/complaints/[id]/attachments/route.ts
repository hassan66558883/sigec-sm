import { NextRequest, NextResponse } from "next/server";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { ApiError, handleApiError } from "@/lib/api";
import { addComplaintAttachmentAsCitizen, assertCanAttachToComplaintAsCitizen } from "@/lib/services/complaints";
import { saveAttachmentFile } from "@/lib/complaint-attachments";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await getCurrentCitizenAccount();
    if (!account) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;

    // Verifie AVANT d'ecrire quoi que ce soit sur disque.
    await assertCanAttachToComplaintAsCitizen(account, id);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Fichier requis.");

    const saved = await saveAttachmentFile(id, file);
    const data = await addComplaintAttachmentAsCitizen(account, id, saved);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
