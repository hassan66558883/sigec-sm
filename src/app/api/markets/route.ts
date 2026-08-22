import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listMarkets, createMarket, createStall } from "@/lib/services/markets";

export async function GET() {
  try {
    const user = await requirePermission("markets", "view");
    const data = await listMarkets(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

// body: { name, arrondissementId, quartierId? } pour un marche,
// ou { marketId, code } pour ajouter un emplacement (voir champ `stall`).
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("markets", "create");
    const body = await req.json();
    if (body.stall) {
      const created = await createStall(user, body.stall);
      return NextResponse.json({ data: created }, { status: 201 });
    }
    const created = await createMarket(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
