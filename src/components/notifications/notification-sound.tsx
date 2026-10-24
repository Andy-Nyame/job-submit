"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import type { ShellNotification } from "./notification-bell";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "jobsubmit.notification-sounds.v1";
const PREFERENCE_EVENT = "jobsubmit:notification-sound-preference";
const IMPORTANT_TYPES = new Set([
  "COSTING_REQUIRED",
  "COUNTEROFFER_SUBMITTED",
  "JOB_STATUS_UPDATED",
  "JOB_SUBMITTED",
  "QUOTATION_ACCEPTED",
  "QUOTATION_DECLINED",
  "QUOTATION_ISSUED",
  "QUOTATION_REVISED",
  "QUOTATION_WITHDRAWN",
]);

let sharedAudioContext: AudioContext | null = null;

function readPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function subscribeToPreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PREFERENCE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PREFERENCE_EVENT, onChange);
  };
}

function audioContext() {
  sharedAudioContext ??= new AudioContext();
  return sharedAudioContext;
}

async function unlockAudio() {
  const context = audioContext();
  if (context.state === "suspended") await context.resume();
}

async function playChime() {
  try {
    await unlockAudio();
    const context = audioContext();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);
    gain.connect(context.destination);

    for (const [frequency, delay] of [[660, 0], [880, 0.14]] as const) {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      oscillator.connect(gain);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + 0.28);
    }
  } catch {
    // Browser audio policies may still block playback. The preference remains safe.
  }
}

export function NotificationSoundListener({
  notifications,
}: {
  notifications: readonly ShellNotification[];
}) {
  const initialized = useRef(false);
  const enabled = useRef(false);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    enabled.current = readPreference();
    function syncPreference() {
      enabled.current = readPreference();
    }
    window.addEventListener(PREFERENCE_EVENT, syncPreference);
    return () => window.removeEventListener(PREFERENCE_EVENT, syncPreference);
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      notifications.forEach((notification) => seenIds.current.add(notification.id));
      initialized.current = true;
      return;
    }

    const hasImportantNewNotification = notifications.some(
      (notification) =>
        !seenIds.current.has(notification.id) &&
        IMPORTANT_TYPES.has(notification.type),
    );
    notifications.forEach((notification) => seenIds.current.add(notification.id));

    if (
      hasImportantNewNotification &&
      enabled.current &&
      document.visibilityState === "visible"
    ) {
      void playChime();
    }
  }, [notifications]);

  return null;
}

export function NotificationSoundControls() {
  const enabled = useSyncExternalStore(
    subscribeToPreference,
    readPreference,
    () => false,
  );

  async function toggleSound() {
    const next = !enabled;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      return;
    }
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
    if (next) await unlockAudio().catch(() => undefined);
  }

  return (
    <section aria-labelledby="notification-sound-heading" className="rounded-2xl border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-semibold" id="notification-sound-heading">
            Notification sounds
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Optional gentle sounds for important new alerts on this device. Sounds
            are off by default and work only while this app is open and visible.
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold">
          {enabled ? "ON" : "OFF"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={() => void toggleSound()} type="button" variant="outline">
          {enabled ? "Mute sounds" : "Enable sounds"}
        </Button>
        <Button
          disabled={!enabled}
          onClick={() => void playChime()}
          type="button"
          variant="outline"
        >
          Test Sound
        </Button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">
        Your choice is stored only in this browser. Browser audio rules, a muted
        device, a sleeping tab, or a closed app can prevent playback.
      </p>
    </section>
  );
}
