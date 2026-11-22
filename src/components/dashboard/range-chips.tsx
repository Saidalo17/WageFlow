import Link from "next/link";
import { cn } from "@/lib/utils";

/** Period choice as a glass pill group: links, so the choice lives in the address and works without scripts. */
export function RangeChips<T extends string>({
  ranges,
  active,
  hrefFor,
  labelFor,
  ariaLabel,
}: {
  ranges: readonly T[];
  active: T;
  hrefFor: (range: T) => string;
  labelFor: (range: T) => string;
  ariaLabel: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="glass inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
      {ranges.map((r) => (
        <Link
          key={r}
          href={hrefFor(r)}
          scroll={false}
          aria-current={active === r ? "true" : undefined}
          className={cn(
            "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-all focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            active === r
              ? "bg-[color-mix(in_oklab,var(--primary)_20%,transparent)] text-primary-strong shadow-[var(--glow)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {labelFor(r)}
        </Link>
      ))}
    </nav>
  );
}
