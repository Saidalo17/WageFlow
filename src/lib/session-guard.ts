/**
 * "Close the window = signed out". The session cookie itself outlives the browser, so the app notes that it is
 * open: every few seconds a heartbeat is written to localStorage (shared by all tabs of this browser) and a flag
 * to sessionStorage (belongs to one tab, survives a reload, vanishes when the tab is closed).
 * A tab that opens with no flag and an old heartbeat means every window was closed in between: sign out.
 * Each device does this on its own, so every device asks for the password again.
 */
export const BEAT_KEY = "kapio-beat";
const TAB_KEY = "kapio-tab";
const BEAT_EVERY_MS = 5_000;
/** Background tabs are throttled to about once a minute, so the limit has to be longer than that. */
const STALE_AFTER_MS = 75_000;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Call right after a successful sign-in or sign-up: a fresh session must never look "left over". */
export function markActive() {
  safe(() => localStorage.setItem(BEAT_KEY, String(Date.now())), undefined);
  safe(() => sessionStorage.setItem(TAB_KEY, "1"), undefined);
}

/** True when the browser was fully closed since the last visit. */
export function wasClosedSinceLastVisit(): boolean {
  const hasTabFlag = safe(() => sessionStorage.getItem(TAB_KEY) === "1", true);
  if (hasTabFlag) return false;
  const last = Number(safe(() => localStorage.getItem(BEAT_KEY), null));
  if (!last) return false; // nothing recorded (storage cleared or blocked): do not lock people out by guessing
  return Date.now() - last > STALE_AFTER_MS;
}

/** Starts the heartbeat; returns a function that stops it. */
export function startHeartbeat(): () => void {
  const beat = () => safe(() => localStorage.setItem(BEAT_KEY, String(Date.now())), undefined);
  safe(() => sessionStorage.setItem(TAB_KEY, "1"), undefined);
  beat();
  const timer = setInterval(beat, BEAT_EVERY_MS);
  window.addEventListener("pagehide", beat);
  document.addEventListener("visibilitychange", beat);
  return () => {
    clearInterval(timer);
    window.removeEventListener("pagehide", beat);
    document.removeEventListener("visibilitychange", beat);
  };
}
