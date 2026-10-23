import "server-only";

import {
  isSafeNotificationHref,
  notificationTypesForRole,
} from "@/domain/notification-policy";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

async function ensureCurrentMembership(actor: ApplicationPrincipal) {
  return prisma.businessMembership.findFirst({
    where: {
      business: { archivedAt: null, isActive: true },
      businessId: actor.businessId,
      deactivatedAt: null,
      id: actor.membershipId,
      status: "ACTIVE",
      user: { deactivatedAt: null, id: actor.userId },
    },
    select: { id: true },
  });
}

export async function markNotificationRead(
  actor: ApplicationPrincipal,
  notificationId: string,
) {
  if (!UUID_PATTERN.test(notificationId) || !(await ensureCurrentMembership(actor))) {
    return false;
  }
  const updated = await prisma.notification.updateMany({
    data: { readAt: new Date() },
    where: {
      businessId: actor.businessId,
      id: notificationId,
      readAt: null,
      recipientUserId: actor.userId,
      type: { in: [...notificationTypesForRole(actor.role)] },
    },
  });
  if (updated.count === 1) return true;
  return Boolean(
    await prisma.notification.findFirst({
      where: {
        businessId: actor.businessId,
        id: notificationId,
        recipientUserId: actor.userId,
        type: { in: [...notificationTypesForRole(actor.role)] },
      },
      select: { id: true },
    }),
  );
}

export async function markAllNotificationsRead(actor: ApplicationPrincipal) {
  if (!(await ensureCurrentMembership(actor))) return 0;
  const result = await prisma.notification.updateMany({
    data: { readAt: new Date() },
    where: {
      businessId: actor.businessId,
      readAt: null,
      recipientUserId: actor.userId,
      type: { in: [...notificationTypesForRole(actor.role)] },
    },
  });
  return result.count;
}

export async function openNotification(
  actor: ApplicationPrincipal,
  notificationId: string,
) {
  if (!UUID_PATTERN.test(notificationId) || !(await ensureCurrentMembership(actor))) {
    return null;
  }
  const notification = await prisma.notification.findFirst({
    where: {
      businessId: actor.businessId,
      id: notificationId,
      recipientUserId: actor.userId,
      type: { in: [...notificationTypesForRole(actor.role)] },
    },
    select: { href: true },
  });
  if (!notification) return null;
  await prisma.notification.updateMany({
    data: { readAt: new Date() },
    where: {
      businessId: actor.businessId,
      id: notificationId,
      readAt: null,
      recipientUserId: actor.userId,
      type: { in: [...notificationTypesForRole(actor.role)] },
    },
  });
  return isSafeNotificationHref(notification.href) ? notification.href : null;
}
