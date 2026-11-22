import { formatDate } from "@/lib/format";
import type { MonthTotals } from "@/lib/salary-stats";

/**
 * Gross and net pay per month as a plain SVG: it prints sharply, needs no script and does not depend on the theme.
 * Colors are fixed on purpose (the report is always a light sheet of paper).
 */
export function ReportChart({
  months,
  locale,
  labels,
  ariaLabel,
}: {
  months: MonthTotals[];
  locale: string;
  labels: { gross: string; net: string };
  ariaLabel: string;
}) {
  const W = 720;
  const H = 190;
  const padTop = 10;
  const padBottom = 24;
  const plotH = H - padTop - padBottom;
  const max = Math.max(...months.map((m) => m.gross), 1);
  const slot = W / months.length;
  const barW = Math.min(slot * 0.34, 22);

  return (
    <figure className="break-inside-avoid">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
        <line x1="0" x2={W} y1={padTop + plotH} y2={padTop + plotH} stroke="#d4d4d8" />
        {months.map((m, i) => {
          const cx = slot * i + slot / 2;
          const gh = (m.gross / max) * plotH;
          const nh = (m.net / max) * plotH;
          return (
            <g key={m.month}>
              {m.gross > 0 && <rect x={cx - barW - 1} y={padTop + plotH - gh} width={barW} height={gh} rx="3" fill="#a1a1aa" />}
              {m.net > 0 && <rect x={cx + 1} y={padTop + plotH - nh} width={barW} height={nh} rx="3" fill="#16a34a" />}
              <text x={cx} y={H - 7} textAnchor="middle" fontSize="11" fill="#52525b">
                {formatDate(`${m.month}-01`, locale, { month: "short" })}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#a1a1aa]" aria-hidden />
          {labels.gross}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#16a34a]" aria-hidden />
          {labels.net}
        </span>
      </figcaption>
    </figure>
  );
}
