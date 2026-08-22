import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Charge l'utilisateur courant et verifie la permission demandee. Leve une
// ApiError (401/403) sinon, a capturer par le route handler appelant.
export async function requirePermission(module: string, action: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Non authentifie.");
  if (!can(user, module, action)) throw new ApiError(403, "Permission insuffisante.");
  return user;
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[api] erreur non geree:", error);
  return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
}
