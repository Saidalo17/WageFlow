"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

/** A sun / moon pill: one click for each theme. (The menu in the top bar also offers "system".) */
export function ThemeSwitch({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const { resolvedTheme, setTheme } = useTheme();
  // The server does not know the visitor's theme, so nothing is shown as chosen until the page is in the browser.
  const hydrated = useHydrated();
  const current = hydrated ? resolvedTheme : null;

  return (
    <div role="radiogroup" aria-label={t("label")} className={cn("glass inline-flex gap-1 rounded-full p-1", className)}>
      {(
        [
          ["light", Sun, t("light")],
          ["dark", Moon, t("dark")],
        ] as const
      ).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          aria-label={label}
          onClick={() => setTheme(value)}
          className={cn(
            "grid size-9 place-items-center rounded-full transition-all focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            current === value
              ? "bg-[color-mix(in_oklab,var(--primary)_20%,transparent)] text-primary-strong shadow-[var(--glow)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
