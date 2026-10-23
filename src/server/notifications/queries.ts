import "server-only";

import {
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_RECENT_LIMIT,
  notificationTypesForRole,
  type NotificationListFilters,
} from "@/domain/notification-policy";
import { requireBusinessMembership } from "@/server/auth/authorization";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";

function recipientWhere(principal: ApplicationPrincipal) {
  return {
    business: { archivedAt: null, isActive: true },
    businessId: principal.businessId,
    recipient: {
      deactivatedAt: null,
      id: principal.membershipId,
      status: "ACTIVE" as const,
      user: { deactivatedAt: null, id: principal.userId },
    },
    recipientUserId: principal.userId,
    type: { in: [...notificationTypesForRole(principal.role)] },
  };
}

const notificationSelect = {
  body: true,
  createdAt: true,
  href: true,
  id: true,
  readAt: true,
  title: true,
  type: true,
} as const;

export async function getNotificationShellData(
  principal: ApplicationPrincipal,
) {
  const where = recipientWhere(principal);
  const [unreadCount, notifications] = await Promise.all([
    prisma.notification.count({ where: { ...where, readAt: null } }),
    prisma.notification.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: notificationSelect,
      take: NOTIFICATION_RECENT_LIMIT,
      where,
    }),
  ]);
  return {
    notifications: notifications.map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
    })),
    unreadCount,
  };
}

export async function getNotificationCenter(filters: NotificationListFilters) {
  const principal = await requireBusinessMembership();
  const baseWhere = recipientWhere(principal);
  const where = {
    ...baseWhere,
    ...(filters.filter === "UNREAD" ? { readAt: null } : {}),
  };
  const [totalNotifications, unreadCount] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...baseWhere, readAt: null } }),
  ]);
  const totalPages = Math.max(
    1,
    Math.ceil(totalNotifications / NOTIFICATION_PAGE_SIZE),
  );
  const page = Math.min(filters.page, totalPages);
  const notifications = await prisma.notification.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: notificationSelect,
    skip: (page - 1) * NOTIFICATION_PAGE_SIZE,
    take: NOTIFICATION_PAGE_SIZE,
    where,
  });
  return {
    filter: filters.filter,
    notifications,
    page,
    principal,
    totalNotifications,
    totalPages,
    unreadCount,
  };
}
