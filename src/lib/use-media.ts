"use client";

import { useSyncExternalStore } from "react";

/** True on phones (under 640px). False on the server, so modals render as dialogs first. */
export function useIsMobile() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(max-width: 639px)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(max-width: 639px)").matches,
    () => false,
  );
}
