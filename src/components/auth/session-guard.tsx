"use client";

import { useEffect } from "react";
import { startHeartbeat, wasClosedSinceLastVisit } from "@/lib/session-guard";

/** Signs the user out when the browser was closed and opened again (see lib/session-guard.ts). */
export function SessionGuard() {
  useEffect(() => {
    if (wasClosedSinceLastVisit()) {
      window.location.replace("/api/session-expired");
      return;
    }
    return startHeartbeat();
  }, []);
  return null;
}
