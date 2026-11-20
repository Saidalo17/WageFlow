import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_ACCENT = "#4F46E5";

/** Black or white text, whichever is easier to read on the given #RRGGBB background. */
function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l > 0.4 ? "#111827" : "#FFFFFF";
}

/**
 * The user's round picture: the uploaded photo, otherwise the chosen emoji,
 * otherwise the first letter of the name, on the profile's accent color.
 */
export function UserAvatar({
  name,
  avatarVersion,
  emoji,
  accent,
  className,
}: {
  name: string | null;
  avatarVersion: number | null;
  emoji: string | null;
  accent: string | null;
  className?: string;
}) {
  const bg = accent ?? DEFAULT_ACCENT;
  const initial = name?.trim().charAt(0).toUpperCase();
  return (
    <span
      className={cn("grid size-9 shrink-0 place-items-center overflow-hidden rounded-full text-base font-bold select-none", className)}
      style={{ background: `linear-gradient(135deg, ${bg}, ${bg}cc)`, color: readableOn(bg) }}
    >
      {avatarVersion ? (
        // eslint-disable-next-line @next/next/no-img-element -- a private, already small picture served by our own API
        <img src={`/api/avatar?v=${avatarVersion}`} alt="" className="size-full object-cover" />
      ) : emoji ? (
        <span aria-hidden className="leading-none">{emoji}</span>
      ) : initial ? (
        <span aria-hidden>{initial}</span>
      ) : (
        <UserRound className="size-1/2" aria-hidden />
      )}
    </span>
  );
}
