"use client";

import { useSyncExternalStore } from "react";
import { todayISO } from "@/lib/format";

const subscribe = () => () => {};

/**
 * Today's date (YYYY-MM-DD) in the visitor's own time zone, plus yesterday's.
 * Empty strings while rendering on the server, so "Today"/"Yesterday" are never decided
 * in the server's time zone; the labels appear as soon as the page is in the browser.
 */
export function useToday() {
  const today = useSyncExternalStore(subscribe, () => todayISO(), () => "");
  if (!today) return { today: "", yesterday: "" };
  const [y, m, d] = today.split("-").map(Number);
  return { today, yesterday: todayISO(new Date(y, m - 1, d - 1)) };
}
