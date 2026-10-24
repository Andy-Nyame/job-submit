"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const REFRESH_INTERVAL_MS = 20_000;

export function ForegroundRefresh() {
  const router = useRouter();
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    let refreshing = false;
    function refresh() {
      if (refreshing || document.visibilityState !== "visible" || !navigator.onLine) return;
      refreshing = true;
      router.refresh();
      window.setTimeout(() => {
        refreshing = false;
      }, 1_000);
    }
    function onOnline() {
      setOnline(true);
      refresh();
    }
    function onOffline() {
      setOnline(false);
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh();
    }
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return online ? null : (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-warning/45 bg-surface px-4 py-3 text-center text-sm font-medium shadow-lg" role="status">
      You&apos;re offline. Saved information stays visible; JobSubmit will update when the connection returns.
    </div>
  );
}
