"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { recordSnapshot } from "@/app/(app)/net-worth/actions";
import { todayISO } from "@/lib/format";

/**
 * Saves today's net worth once per day the page is opened (the server works the numbers out itself),
 * then refreshes so the chart shows the new point. Draws nothing.
 */
export function SnapshotRecorder({ lastDate }: { lastDate: string | null }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    const today = todayISO();
    if (done.current || lastDate === today) return;
    done.current = true;
    void recordSnapshot(today).then((r) => {
      if (r.ok) router.refresh();
    });
  }, [lastDate, router]);

  return null;
}
