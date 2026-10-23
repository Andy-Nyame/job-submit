"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireBusinessMembership } from "@/server/auth/authorization";
import {
  markAllNotificationsRead,
  markNotificationRead,
  openNotification,
} from "@/server/notifications/management";

function notificationId(formData: FormData) {
  const value = formData.get("notificationId");
  return typeof value === "string" ? value : "";
}

function revalidateNotifications() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/notifications");
}

export async function markNotificationReadAction(formData: FormData) {
  const actor = await requireBusinessMembership();
  await markNotificationRead(actor, notificationId(formData));
  revalidateNotifications();
}

export async function markAllNotificationsReadAction() {
  const actor = await requireBusinessMembership();
  await markAllNotificationsRead(actor);
  revalidateNotifications();
}

export async function openNotificationAction(formData: FormData) {
  const actor = await requireBusinessMembership();
  const href = await openNotification(actor, notificationId(formData));
  revalidateNotifications();
  redirect(href ?? "/app/notifications");
}
