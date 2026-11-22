import { getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/card";
import { formatDate } from "@/lib/format";
import type { HeatLevel, Heatmap } from "@/lib/heatmap";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Gold gets stronger with the day's spending; the empty days stay neutral. */
const LEVEL: Record<HeatLevel, string> = {
  0: "bg-muted",
  1: "bg-gold/25",
  2: "bg-gold/45",
  3: "bg-gold/70",
  4: "bg-gold",
};

/** Daily spending of the last weeks as a calendar grid (weeks across, Monday to Sunday down). */
export async function HeatmapTile({
  heatmap,
  currency,
  index,
  className,
}: {
  heatmap: Heatmap;
  currency: string;
  index: number;
  className?: string;
}) {
  const [t, locale] = await Promise.all([getTranslations("overview"), getLocale()]);
  const weeks = heatmap.columns.length;
  const money = (minor: number) => formatMoney(minor, currency, locale);

  // Weekday names from the locale: 2026-11-16 is a Monday.
  const weekday = (i: number) => formatDate(`2026-11-${16 + i}`, locale, { weekday: "short" });
  // The month name above the first week in which a month begins
  const monthLabel = (col: Heatmap["columns"][number], i: number) => {
    const first = col[0].date.slice(0, 7);
    const prev = i > 0 ? heatmap.columns[i - 1][0].date.slice(0, 7) : "";
    return first !== prev ? formatDate(col[0].date, locale, { month: "short" }) : "";
  };

  return (
    <Card title={t("heatmapTitle")} index={index} className={cn("lift", className)}>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">{t("heatmapHint", { weeks })}</p>
      <div
        role="img"
        aria-label={t("heatmapAria", { total: money(heatmap.total), weeks, max: money(heatmap.max) })}
        className="flex items-start gap-2 overflow-x-auto pb-1"
      >
        {/* Weekday names (every second one, to save room) */}
        <div aria-hidden className="mt-5 hidden shrink-0 flex-col gap-1 text-xs text-muted-foreground sm:flex">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="h-5 leading-5">
              {i % 2 === 0 ? weekday(i) : ""}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          {heatmap.columns.map((col, i) => (
            <div key={col[0].date} className="flex flex-col gap-1">
              <span aria-hidden className="h-4 text-[11px] leading-4 text-muted-foreground">
                {monthLabel(col, i)}
              </span>
              {col.map((cell) => (
                <span
                  key={cell.date}
                  title={cell.inRange ? `${formatDate(cell.date, locale, { day: "numeric", month: "long" })}: ${money(cell.value)}` : undefined}
                  className={cn(
                    "size-4 rounded-[5px] transition-transform hover:scale-125 sm:size-5",
                    cell.inRange ? LEVEL[cell.level] : "bg-transparent",
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        {t("less")}
        {([0, 1, 2, 3, 4] as const).map((l) => (
          <span key={l} className={cn("size-3.5 rounded-[4px]", LEVEL[l])} />
        ))}
        {t("more")}
      </div>
    </Card>
  );
}
