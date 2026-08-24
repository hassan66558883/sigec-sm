import { NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listTechnoProducts } from "@/lib/services/technotchad";

export async function GET() {
  try {
    const user = await requirePermission("technotchad_products", "view");
    const data = await listTechnoProducts(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
