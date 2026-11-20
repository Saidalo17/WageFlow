"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { dayPart } from "@/lib/day-part";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "salary-welcome-back";

/** Re-reads the clock once a minute, so the greeting changes by itself at the turn of the day part. */
function subscribeMinute(onChange: () => void) {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
}
const subscribeNever = () => () => {};

function storedAway() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * "Good morning, Ella" by the visitor's local time. After a long absence it says
 * "Glad you're back, Ella" instead. The time is read in the browser, never on the server,
 * because the server does not know the visitor's time zone.
 */
export function Greeting({ name, away }: { name?: string; away: boolean }) {
  const t = useTranslations("overview");
  // -1 on the server and during hydration.
  const hour = useSyncExternalStore(subscribeMinute, () => new Date().getHours(), () => -1);
  // "Away" is decided on the server once; remember it for this visit so a refresh doesn't drop it.
  const remembered = useSyncExternalStore(subscribeNever, storedAway, () => false);
  useEffect(() => {
    if (!away) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode: the greeting just won't be remembered */
    }
  }, [away]);

  const ready = hour >= 0;
  const part = away || remembered ? "back" : ready ? dayPart(hour) : null;
  const group = name ? "hello" : "helloAnon";

  const text = part
    ? t(`${group}.${part}`, { name: name ?? "" })
    : name
      ? t("greeting", { name })
      : t("greetingAnon");

  return (
    <h1
      className={cn(
        "text-[28px] font-extrabold tracking-tight transition-opacity duration-300",
        !part && "opacity-0",
      )}
    >
      {text}
    </h1>
  );
}
