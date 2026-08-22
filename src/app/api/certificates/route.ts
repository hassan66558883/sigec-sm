import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError, ApiError } from "@/lib/api";
import {
  listCertificates,
  issueBirthCertificate,
  issueRecognitionCertificate,
  issueMarriageCertificate,
  issueDeathCertificate,
} from "@/lib/services/certificates";

export async function GET() {
  try {
    const user = await requirePermission("certificates", "view");
    const data = await listCertificates(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

// body: { sourceType: "birth" | "recognition" | "marriage" | "death", sourceId }
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("certificates", "create");
    const body = await req.json();
    let created;
    switch (body.sourceType) {
      case "birth":
        created = await issueBirthCertificate(user, body.sourceId);
        break;
      case "recognition":
        created = await issueRecognitionCertificate(user, body.sourceId);
        break;
      case "marriage":
        created = await issueMarriageCertificate(user, body.sourceId);
        break;
      case "death":
        created = await issueDeathCertificate(user, body.sourceId);
        break;
      default:
        throw new ApiError(400, "Type de source invalide.");
    }
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
