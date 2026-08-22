import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, requirePermission, handleApiError } from "@/lib/api";
import { listActivities, createActivity } from "@/lib/services/activities";

// Referentiel, meme faible sensibilite que TaxType/MarriageRegime : liste
// accessible a tout compte authentifie (necessaire aux formulaires de
// creation boutique/marche de tous les agents, pas seulement ceux gerant
// la tarification), la CREATION reste elle gardee par tariffs:create.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const data = await listActivities();
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("tariffs", "create");
    const body = await req.json();
    const created = await createActivity(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
