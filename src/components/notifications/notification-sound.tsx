"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import type { ApplicationRole } from "@/domain/auth-policy";

import type { ShellNotification } from "./notification-bell";

const STORAGE_KEY = "jobsubmit.notification-alerts.v2";
const LEGACY_STORAGE_KEY = "jobsubmit.notification-sounds.v1";
const PREFERENCE_EVENT = "jobsubmit:notification-alert-preference";
type AlertMode = "SILENT" | "SOUND" | "VOICE" | "SOUND_VOICE";
interface AlertPreference { mode: AlertMode; voice: string; volume: number }
const DEFAULT_PREFERENCE: AlertPreference = { mode: "SILENT", voice: "", volume: 0.65 };
const IMPORTANT_TYPES = new Set([
  "COSTING_REQUIRED",
  "COUNTEROFFER_SUBMITTED",
  "JOB_SUBMITTED",
  "QUOTATION_ACCEPTED",
  "QUOTATION_ISSUED",
  "QUOTATION_REVISED",
  "READY_FOR_PICKUP",
  "WORKER_ASSIGNED",
  "WEBSITE_ENQUIRY_RECEIVED",
  "WEBSITE_ENQUIRY_REPLY",
]);
let sharedAudioContext: AudioContext | null = null;

function preferenceString() {
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) return current;
    if (window.localStorage.getItem(LEGACY_STORAGE_KEY) === "on") {
      return JSON.stringify({ ...DEFAULT_PREFERENCE, mode: "SOUND" });
    }
  } catch {
    // Device storage can be blocked. Silent remains the safe default.
  }
  return JSON.stringify(DEFAULT_PREFERENCE);
}

function readPreference(): AlertPreference {
  try {
    const parsed = JSON.parse(preferenceString()) as Partial<AlertPreference>;
    const mode = ["SILENT", "SOUND", "VOICE", "SOUND_VOICE"].includes(parsed.mode ?? "")
      ? parsed.mode as AlertMode
      : "SILENT";
    const volume = typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 1
      ? parsed.volume
      : DEFAULT_PREFERENCE.volume;
    return { mode, voice: typeof parsed.voice === "string" ? parsed.voice : "", volume };
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

function savePreference(preference: AlertPreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
  } catch {
    // The visual notification center remains authoritative.
  }
}

function subscribe(onChange: () => void) {
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

async function playChime(volume: number) {
  try {
    await unlockAudio();
    const context = audioContext();
    const gain = context.createGain();
    const peak = Math.max(0.02, volume * 0.18);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.72);
    gain.connect(context.destination);
    for (const [frequency, delay] of [[620, 0], [820, 0.18], [980, 0.34]] as const) {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      oscillator.connect(gain);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + 0.32);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 760));
  } catch {
    // Autoplay rules and device audio policy may block sound without affecting visual alerts.
  }
}

function speak(message: string, preference: AlertPreference) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.volume = preference.volume;
    utterance.rate = 0.95;
    const selected = window.speechSynthesis.getVoices().find((voice) => voice.name === preference.voice);
    if (selected) utterance.voice = selected;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Visual notifications remain available when speech is unsupported.
  }
}

function announcement(type: string, role: ApplicationRole) {
  const messages: Record<string, string> = {
    COSTING_REQUIRED: "A customer is waiting for a price.",
    COUNTEROFFER_SUBMITTED: "A customer has requested a price change.",
    JOB_SUBMITTED: "Attention! A new customer job has been received.",
    QUOTATION_ACCEPTED: "A customer has accepted your quotation.",
    QUOTATION_ISSUED: "Your price is ready. Please check your job.",
    QUOTATION_REVISED: "Your updated price is ready. Please check your job.",
    READY_FOR_PICKUP: "Good news! Your job is ready for pickup.",
    WORKER_ASSIGNED: "You have been assigned a new job.",
    WEBSITE_ENQUIRY_RECEIVED: "A customer sent a website enquiry message.",
    WEBSITE_ENQUIRY_REPLY: "You have a new reply about your website enquiry.",
  };
  const message = messages[type];
  if (!message) return null;
  if (role === "CUSTOMER" && !["QUOTATION_ISSUED", "QUOTATION_REVISED", "READY_FOR_PICKUP", "WEBSITE_ENQUIRY_REPLY"].includes(type)) return null;
  if (role === "WORKER" && type !== "WORKER_ASSIGNED") return null;
  if ((role === "ADMIN" || role === "OWNER") && !["COSTING_REQUIRED", "COUNTEROFFER_SUBMITTED", "JOB_SUBMITTED", "QUOTATION_ACCEPTED", "WEBSITE_ENQUIRY_RECEIVED"].includes(type)) return null;
  return message;
}

async function playAlert(preference: AlertPreference, message: string) {
  if (preference.mode === "SOUND" || preference.mode === "SOUND_VOICE") {
    await playChime(preference.volume);
  }
  if (preference.mode === "VOICE" || preference.mode === "SOUND_VOICE") {
    speak(message, preference);
  }
}

export function NotificationSoundListener({ notifications, role }: { notifications: readonly ShellNotification[]; role: ApplicationRole }) {
  const initialized = useRef(false);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (!initialized.current) {
      notifications.forEach((notification) => seenIds.current.add(notification.id));
      initialized.current = true;
      return;
    }
    const newlyImportant = notifications.filter(
      (notification) => !seenIds.current.has(notification.id) && IMPORTANT_TYPES.has(notification.type),
    );
    notifications.forEach((notification) => seenIds.current.add(notification.id));
    if (newlyImportant.length === 0 || document.visibilityState !== "visible") return;
    const preference = readPreference();
    if (preference.mode === "SILENT") return;
    const messages = newlyImportant.map((item) => announcement(item.type, role)).filter((value): value is string => Boolean(value));
    if (messages.length === 0) return;
    const message = messages.length === 1 ? messages[0] : `You have ${messages.length} new important notifications.`;
    void playAlert(preference, message);
  }, [notifications, role]);
  return null;
}

export function NotificationSoundControls() {
  const snapshot = useSyncExternalStore(subscribe, preferenceString, () => JSON.stringify(DEFAULT_PREFERENCE));
  const preference = useMemo(() => {
    try { return JSON.parse(snapshot) as AlertPreference; } catch { return DEFAULT_PREFERENCE; }
  }, [snapshot]);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    function updateVoices() { setVoices(window.speechSynthesis.getVoices()); }
    updateVoices();
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
  }, []);

  async function setMode(mode: AlertMode) {
    savePreference({ ...preference, mode });
    if (mode === "SOUND" || mode === "SOUND_VOICE") await unlockAudio().catch(() => undefined);
  }

  return (
    <section aria-labelledby="notification-sound-heading" className="rounded-2xl border bg-surface p-5">
      <h2 className="font-semibold" id="notification-sound-heading">Sound and voice alerts</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Optional alerts for important new notifications on this device. They are silent by default and work only while JobSubmit is open and visible.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><label className="text-sm font-medium" htmlFor="alert-mode">Alert style</label><Select id="alert-mode" onChange={(event) => void setMode(event.target.value as AlertMode)} value={preference.mode}><option value="SILENT">Silent</option><option value="SOUND">Sound only</option><option value="VOICE">Voice only</option><option value="SOUND_VOICE">Sound + Voice</option></Select></div>
        <div><label className="text-sm font-medium" htmlFor="alert-volume">Volume: {Math.round(preference.volume * 100)}%</label><input className="mt-3 block w-full accent-primary" id="alert-volume" max="1" min="0.2" onChange={(event) => savePreference({ ...preference, volume: Number(event.target.value) })} step="0.05" type="range" value={preference.volume} /></div>
        {voices.length > 0 ? <div className="sm:col-span-2"><label className="text-sm font-medium" htmlFor="alert-voice">Browser voice</label><Select id="alert-voice" onChange={(event) => savePreference({ ...preference, voice: event.target.value })} value={preference.voice}><option value="">Device default</option>{voices.map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} ({voice.lang})</option>)}</Select></div> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button disabled={preference.mode === "SILENT"} onClick={() => void playAlert(preference, "This is a JobSubmit test alert.")} type="button" variant="outline">Test Alert</Button>
        <Button disabled={preference.mode === "SILENT"} onClick={() => speak("This is the selected JobSubmit voice.", preference)} type="button" variant="outline">Voice preview</Button>
        <Button onClick={() => void setMode("SILENT")} type="button" variant="outline">Mute</Button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">Your choice stays in this browser. A muted device, blocked autoplay, sleeping tab, or closed app can prevent audio. Visual notifications always remain the reliable record.</p>
    </section>
  );
}
