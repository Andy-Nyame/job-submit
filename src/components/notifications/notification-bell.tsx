"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { openNotificationAction } from "@/app/app/notifications/actions";
import { cn } from "@/lib/class-names";

export interface ShellNotification {
  body: string | null;
  createdAt: string;
  href: string | null;
  id: string;
  readAt: string | null;
  title: string;
  type: string;
}

function BellIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M18 9.5a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18c0-1.5-3-1.5-3-8.5ZM9.8 21h4.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function formatBellDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "Africa/Accra",
  }).format(new Date(value));
}

export function NotificationBell({
  className,
  notifications,
  unreadCount,
}: {
  className?: string;
  notifications: readonly ShellNotification[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function close(event: KeyboardEvent | MouseEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      } else if (
        event instanceof MouseEvent &&
        !containerRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", close);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("mousedown", close);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications, none unread"
        }
        className="relative grid size-11 place-items-center rounded-lg border border-border-strong bg-surface text-foreground outline-none transition-colors hover:border-primary/50 hover:bg-primary-surface hover:text-primary-surface-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-surface bg-primary px-1 text-[0.625rem] font-bold leading-none text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          aria-label="Recent notifications"
          className="absolute right-0 z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-surface shadow-[0_24px_60px_-28px_var(--shadow-color)]"
          id={panelId}
          role="dialog"
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Notifications</h2>
              <p className="text-xs text-muted">{unreadCount} unread</p>
            </div>
            <Link
              className="rounded-md px-2 py-1 text-xs font-semibold text-primary outline-none hover:bg-primary-surface focus-visible:ring-2 focus-visible:ring-ring"
              href="/app/notifications"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-[min(26rem,65vh)] divide-y overflow-y-auto overscroll-contain">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <form action={openNotificationAction}>
                    <input name="notificationId" type="hidden" value={notification.id} />
                    <button
                      className="grid w-full grid-cols-[auto_1fr] gap-3 px-4 py-3 text-left outline-none hover:bg-surface-hover focus-visible:bg-primary-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      type="submit"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-1.5 size-2 rounded-full",
                          notification.readAt ? "bg-border-strong" : "bg-primary",
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {notification.title}
                        </span>
                        {notification.body ? (
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted">
                            {notification.body}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[0.6875rem] text-muted">
                          {formatBellDate(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
