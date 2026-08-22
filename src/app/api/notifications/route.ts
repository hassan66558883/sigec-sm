import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { listMyNotifications, countUnreadNotifications, markAllNotificationsRead } from "@/lib/services/notifications";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const unreadOnly = req.nextUrl.searchParams.get("unread") === "1";
    const [data, unreadCount] = await Promise.all([listMyNotifications(user, unreadOnly), countUnreadNotifications(user)]);
    return NextResponse.json({ data, unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    await markAllNotificationsRead(user);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
