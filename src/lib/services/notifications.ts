import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";

// Notifications internes (section 32). Aucun canal email/SMS reel
// (architecture prevue, non implementee — necessiterait un fournisseur) :
// uniquement in-app, visible depuis la cloche de /admin.

async function notifyUsers(userIds: string[], input: { title: string; message: string; severity?: string; link?: string }) {
  if (userIds.length === 0) return;
  await prisma.staffNotification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: input.title,
      message: input.message,
      severity: input.severity ?? "INFO",
      link: input.link,
    })),
  });
}

// Superviseurs d'un arrondissement donne : tout utilisateur autorise a
// traiter les alertes (fraud:resolve) et rattache a cet arrondissement, ou
// en portee globale (Mairie Centrale voit toujours tout).
export async function notifyArrondissementSupervisors(arrondissementId: string, input: { title: string; message: string; severity?: string; link?: string }) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { permissions: { some: { permission: { code: "fraud:resolve" } } } } } },
      OR: [{ organizationLevel: "CENTRAL" }, { arrondissements: { some: { arrondissementId } } }],
    },
    select: { id: true },
  });
  await notifyUsers(users.map((u) => u.id), input);
}

export async function notifyCentralAdmins(input: { title: string; message: string; severity?: string; link?: string }) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      organizationLevel: "CENTRAL",
      roles: { some: { role: { permissions: { some: { permission: { code: "fraud:resolve" } } } } } },
    },
    select: { id: true },
  });
  await notifyUsers(users.map((u) => u.id), input);
}

export async function listMyNotifications(user: CurrentUser, unreadOnly = false) {
  return prisma.staffNotification.findMany({
    where: { userId: user.id, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function countUnreadNotifications(user: CurrentUser) {
  return prisma.staffNotification.count({ where: { userId: user.id, isRead: false } });
}

export async function markNotificationRead(user: CurrentUser, id: string) {
  const notif = await prisma.staffNotification.findUnique({ where: { id } });
  if (!notif) throw new ApiError(404, "Notification introuvable.");
  if (notif.userId !== user.id) throw new ApiError(403, "Hors de votre perimetre.");
  return prisma.staffNotification.update({ where: { id }, data: { isRead: true } });
}

export async function markAllNotificationsRead(user: CurrentUser) {
  await prisma.staffNotification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
}
