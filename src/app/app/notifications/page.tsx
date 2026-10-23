import type { Metadata } from "next";
import Link from "next/link";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  openNotificationAction,
} from "./actions";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  NotificationPolicyError,
  parseNotificationListFilters,
} from "@/domain/notification-policy";
import { getNotificationCenter } from "@/server/notifications/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications" };

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(value);
}

function notificationLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./u, (character) => character.toUpperCase());
}

function pageHref(filter: "ALL" | "UNREAD", page: number) {
  const query = new URLSearchParams();
  if (filter === "UNREAD") query.set("filter", "unread");
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/app/notifications?${suffix}` : "/app/notifications";
}

interface NotificationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const params = await searchParams;
  let invalidFilters = false;
  let filters;
  try {
    filters = parseNotificationListFilters(params);
  } catch (error) {
    if (!(error instanceof NotificationPolicyError)) throw error;
    filters = parseNotificationListFilters({});
    invalidFilters = true;
  }
  const data = await getNotificationCenter(filters);

  return (
    <main className="py-10 sm:py-14" id="main-content">
      <Container className="max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Action center
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Notifications
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Important job and quotation updates for your current business and
              role. Domain actions remain protected on their destination pages.
            </p>
          </div>
          {data.unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="outline">
                Mark all read
              </Button>
            </form>
          ) : null}
        </header>

        {invalidFilters ? (
          <div className="mt-6 rounded-xl border border-destructive/45 bg-destructive-surface p-4 text-sm" role="alert">
            Invalid notification filters were safely reset.
          </div>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
          <nav aria-label="Notification filters" className="flex gap-2">
            {(["ALL", "UNREAD"] as const).map((filter) => (
              <Link
                aria-current={data.filter === filter ? "page" : undefined}
                className={
                  data.filter === filter
                    ? "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    : "rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-semibold outline-none hover:bg-primary-surface focus-visible:ring-2 focus-visible:ring-ring"
                }
                href={pageHref(filter, 1)}
                key={filter}
              >
                {filter === "ALL" ? "All" : `Unread (${data.unreadCount})`}
              </Link>
            ))}
          </nav>
          <p className="text-sm text-muted">
            {data.totalNotifications.toLocaleString("en-US")} notification
            {data.totalNotifications === 1 ? "" : "s"}
          </p>
        </div>

        {data.notifications.length === 0 ? (
          <Card className="mt-5 text-center">
            <h2 className="text-lg font-semibold">
              {data.filter === "UNREAD" ? "You are all caught up" : "No notifications yet"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Meaningful job and quotation activity will appear here when it
              requires your attention.
            </p>
          </Card>
        ) : (
          <ol className="mt-5 grid gap-3">
            {data.notifications.map((notification) => (
              <li
                className={
                  notification.readAt
                    ? "rounded-2xl border bg-surface p-5"
                    : "rounded-2xl border border-primary/35 bg-primary-surface p-5 shadow-[0_14px_38px_-34px_var(--shadow-color)]"
                }
                key={notification.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!notification.readAt ? <Badge>Unread</Badge> : null}
                      <span className="text-xs text-muted">
                        {notificationLabel(notification.type)}
                      </span>
                    </div>
                    <h2 className="mt-2 text-base font-semibold">
                      {notification.title}
                    </h2>
                    {notification.body ? (
                      <p className="mt-2 text-sm leading-6 text-muted">
                        {notification.body}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {notification.href ? (
                      <form action={openNotificationAction}>
                        <input name="notificationId" type="hidden" value={notification.id} />
                        <Button type="submit">Open</Button>
                      </form>
                    ) : null}
                    {!notification.readAt ? (
                      <form action={markNotificationReadAction}>
                        <input name="notificationId" type="hidden" value={notification.id} />
                        <Button type="submit" variant="outline">
                          Mark read
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {data.totalPages > 1 ? (
          <nav aria-label="Notification pagination" className="mt-6 flex items-center justify-between gap-4">
            {data.page > 1 ? (
              <Link className="rounded-lg border border-border-strong px-4 py-2 text-sm font-semibold outline-none hover:bg-primary-surface focus-visible:ring-2 focus-visible:ring-ring" href={pageHref(data.filter, data.page - 1)}>
                Previous
              </Link>
            ) : <span />}
            <p className="text-sm text-muted">Page {data.page} of {data.totalPages}</p>
            {data.page < data.totalPages ? (
              <Link className="rounded-lg border border-border-strong px-4 py-2 text-sm font-semibold outline-none hover:bg-primary-surface focus-visible:ring-2 focus-visible:ring-ring" href={pageHref(data.filter, data.page + 1)}>
                Next
              </Link>
            ) : <span />}
          </nav>
        ) : null}
      </Container>
    </main>
  );
}
