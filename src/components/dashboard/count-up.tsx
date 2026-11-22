"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { formatMoney } from "@/lib/money";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * An amount that rolls up to its value when the page appears or the value changes. It starts close to the final
 * number (not from zero), so nothing flashes, and it shows the final number at once for people who asked for less motion.
 * `value` is positive minor units; `sign` ("+", "−" or "") is put in front.
 */
export function CountUp({ value, currency, sign = "" }: { value: number; currency: string; sign?: string }) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [animated, setAnimated] = useState(value);
  // With reduced motion (or nothing to roll) the final number is shown at once.
  const shown = reduced || value === 0 ? value : animated;

  useEffect(() => {
    if (reduced || value === 0) return;
    const from = Math.round(value * 0.8);
    const start = performance.now();
    const duration = 700;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimated(Math.round(from + (value - from) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return (
    <>
      {sign}
      {formatMoney(shown, currency, locale)}
    </>
  );
}
