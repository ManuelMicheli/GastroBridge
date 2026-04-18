"use client";

/**
 * Chime player — plays a short synthesized notification tone when a new in-app
 * event arrives. Pref is persisted in localStorage and can be muted from
 * /supplier/impostazioni/notifiche.
 *
 * Synthesis via Web Audio API means no MP3 asset is required and no network
 * round-trip happens on the first event. If a file asset exists at
 * /sounds/notification.mp3 it will be preferred (so designers can swap in a
 * brand-matched chime later without touching code).
 *
 * Autoplay policy: browsers allow audio after the user has interacted with the
 * page at least once. Supplier users are logged in, so this is satisfied in
 * practice. If the AudioContext is in `suspended` state we try to resume once,
 * then silently skip playback.
 */

const CHIME_STORAGE_KEY = "supplier.notifications.chime";
const CHIME_FILE_SRC = "/sounds/notification.mp3";

let audioEl: HTMLAudioElement | null = null;
let audioElLoadFailed = false;
let audioCtx: AudioContext | null = null;

function ensureAudioElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (audioElLoadFailed) return null;
  if (!audioEl) {
    try {
      audioEl = new Audio(CHIME_FILE_SRC);
      audioEl.preload = "auto";
      audioEl.volume = 0.5;
      audioEl.addEventListener("error", () => {
        audioElLoadFailed = true;
        audioEl = null;
      });
    } catch {
      audioElLoadFailed = true;
      return null;
    }
  }
  return audioEl;
}

function ensureAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AC =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      audioCtx = new AC();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Two-note "ding" roughly at E6 and A6 with a short envelope. ~280ms total.
 */
function playSynthChime(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);
  master.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

  const notes: Array<{ freq: number; at: number; dur: number }> = [
    { freq: 1318.5, at: now, dur: 0.15 },
    { freq: 1760.0, at: now + 0.08, dur: 0.2 },
  ];

  for (const n of notes) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = n.freq;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.6, n.at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, n.at + n.dur);
    osc.connect(g);
    g.connect(master);
    osc.start(n.at);
    osc.stop(n.at + n.dur + 0.02);
  }
}

export function getChimePref(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(CHIME_STORAGE_KEY);
  if (raw === null) return true;
  return raw === "1";
}

export function setChimePref(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHIME_STORAGE_KEY, enabled ? "1" : "0");
}

export function playChime(): void {
  if (!getChimePref()) return;

  // Prefer the file asset if it loads; otherwise synth.
  const el = ensureAudioElement();
  if (el && !audioElLoadFailed) {
    try {
      el.currentTime = 0;
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // Autoplay blocked or file missing — fall back to synth
          const ctx = ensureAudioContext();
          if (ctx) playSynthChime(ctx);
        });
      }
      return;
    } catch {
      // fall through to synth
    }
  }

  const ctx = ensureAudioContext();
  if (ctx) {
    try {
      playSynthChime(ctx);
    } catch {
      /* ignore */
    }
  }
}
