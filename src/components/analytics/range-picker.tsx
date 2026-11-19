"use client";

import { CalendarRange } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ANALYTICS_RANGES, type AnalyticsRange } from "@/lib/period";
import { cn } from "@/lib/utils";

/** Period chips plus a "custom" option with two date fields. The choice lives in the URL. */
export function RangePicker({
  range,
  from,
  to,
  invalid,
}: {
  range: AnalyticsRange;
  from: string;
  to: string;
  /** The typed custom range was not usable and the page fell back to "this month". */
  invalid: boolean;
}) {
  const t = useTranslations("analytics");
  const router = useRouter();
  const [open, setOpen] = useState(range === "custom" || invalid);
  const [customFrom, setCustomFrom] = useState(range === "custom" ? from : "");
  const [customTo, setCustomTo] = useState(range === "custom" ? to : "");
  const [error, setError] = useState<string | null>(invalid ? "invalidRange" : null);

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      active
        ? "border-transparent bg-accent text-accent-foreground"
        : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  function choose(r: AnalyticsRange) {
    if (r === "custom") {
      setOpen(true);
      return;
    }
    setOpen(false);
    setError(null);
    router.replace(r === "month" ? "/analytics" : `/analytics?range=${r}`, { scroll: false });
  }

  function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!customFrom || !customTo || customFrom > customTo) {
      setError("invalidRange");
      return;
    }
    setError(null);
    router.replace(`/analytics?range=custom&from=${customFrom}&to=${customTo}`, { scroll: false });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("period")}>
        {ANALYTICS_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={r === "custom" ? open || range === "custom" : range === r && !open}
            onClick={() => choose(r)}
            className={chip(r === "custom" ? open || range === "custom" : range === r && !open)}
          >
            {r === "custom" && <CalendarRange className="size-4" />}
            {t(`ranges.${r}`)}
          </button>
        ))}
      </div>

      {open && (
        <form
          onSubmit={apply}
          className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="range-from" className="text-sm font-semibold">
              {t("from")}
            </Label>
            <Input
              id="range-from"
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="range-to" className="text-sm font-semibold">
              {t("to")}
            </Label>
            <Input
              id="range-to"
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-44"
            />
          </div>
          <Button type="submit">{t("apply")}</Button>
          {error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {t(`errors.${error}`)}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
