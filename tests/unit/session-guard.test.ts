import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BEAT_KEY, markActive, wasClosedSinceLastVisit } from "@/lib/session-guard";

function fakeStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}

describe("closing the browser signs the user out", () => {
  let local: ReturnType<typeof fakeStorage>;
  let session: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T10:00:00Z"));
    local = fakeStorage();
    session = fakeStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps a tab that was just used or reloaded", () => {
    markActive();
    vi.advanceTimersByTime(3_600_000); // an hour later, same tab (the flag lives in this tab)
    expect(wasClosedSinceLastVisit()).toBe(false);
  });

  it("opening a second tab while another one is alive does not sign out", () => {
    local.setItem(BEAT_KEY, String(Date.now() - 20_000));
    expect(wasClosedSinceLastVisit()).toBe(false);
  });

  it("signs out when the browser was closed and opened later (no tab flag, old heartbeat)", () => {
    markActive();
    session.clear(); // the tab is gone
    vi.advanceTimersByTime(10 * 60_000);
    expect(wasClosedSinceLastVisit()).toBe(true);
  });

  it("does not guess when nothing was recorded", () => {
    expect(wasClosedSinceLastVisit()).toBe(false);
  });

  it("survives blocked storage without throwing", () => {
    const boom = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    vi.stubGlobal("localStorage", boom);
    vi.stubGlobal("sessionStorage", boom);
    expect(() => markActive()).not.toThrow();
    expect(wasClosedSinceLastVisit()).toBe(false);
  });
});
