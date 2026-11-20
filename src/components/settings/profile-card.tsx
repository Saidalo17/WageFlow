"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { deleteAvatar, updateProfileCard, uploadAvatar } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { CATEGORY_COLORS } from "@/lib/category-meta";
import { squareAvatar } from "@/lib/image-resize";
import { BIO_MAX, PROFILE_EMOJIS } from "@/lib/profile-meta";
import { cn } from "@/lib/utils";

type Props = {
  initial: {
    name: string;
    bio: string;
    emoji: string;
    accent: string;
    avatarVersion: number | null;
  };
};

const DEFAULT_ACCENT = "#4F46E5";

/**
 * The profile "card": photo, emoji, accent color and a short text about yourself.
 * The photo is cropped and shrunk in the browser, then saved right away; the rest is saved with the button.
 */
export function ProfileCard({ initial }: Props) {
  const t = useTranslations("settings.profileCard");
  const tErr = useTranslations("settings.errors");
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [bio, setBio] = useState(initial.bio);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [accent, setAccent] = useState(initial.accent || DEFAULT_ACCENT);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accentValue = accent || DEFAULT_ACCENT;
  const customAccent = !(CATEGORY_COLORS as readonly string[]).includes(accentValue) && accentValue !== DEFAULT_ACCENT;

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again works
    if (!file) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15_000_000) {
      setError("photoInvalid");
      return;
    }
    setPhotoBusy(true);
    try {
      const blob = await squareAvatar(file);
      const form = new FormData();
      form.set("photo", blob, "avatar");
      const result = await uploadAvatar(form);
      if (result.ok) {
        toast.success(t("photoSaved"));
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch {
      setError("photoInvalid");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setError(null);
    const result = await deleteAvatar();
    setPhotoBusy(false);
    if (result.ok) {
      toast.success(t("photoRemoved"));
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    const result = await updateProfileCard({ bio, emoji, accent });
    setSaving(false);
    if (result.ok) {
      toast.success(t("saved"));
      router.refresh();
    } else {
      setError(result.fieldErrors?.bio ?? result.error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Live preview */}
      <div
        className="flex items-center gap-4 rounded-3xl p-5 sm:p-6"
        style={{ background: `linear-gradient(135deg, ${accentValue}33, ${accentValue}0d)`, boxShadow: `inset 0 0 0 1px ${accentValue}40` }}
      >
        <UserAvatar
          name={initial.name || null}
          avatarVersion={initial.avatarVersion}
          emoji={emoji || null}
          accent={accentValue}
          className="size-20 text-3xl ring-4 ring-card sm:size-24 sm:text-4xl"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-extrabold">{initial.name || t("noName")}</p>
          <p className="break-words text-muted-foreground">{bio.trim() || t("bioEmpty")}</p>
        </div>
      </div>

      {/* Photo */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">{t("photo")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={pickPhoto}
            aria-label={t("upload")}
            data-testid="avatar-input"
          />
          <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()} disabled={photoBusy}>
            {photoBusy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {initial.avatarVersion ? t("change") : t("upload")}
          </Button>
          {initial.avatarVersion && (
            <Button type="button" variant="ghost" onClick={removePhoto} disabled={photoBusy}>
              <Trash2 className="size-4" />
              {t("remove")}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t("photoHint")}</p>
      </div>

      {/* Emoji */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t("emoji")}</legend>
        <p className="text-sm text-muted-foreground">{t("emojiHint")}</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("emoji")}>
          <button
            type="button"
            role="radio"
            aria-checked={emoji === ""}
            onClick={() => setEmoji("")}
            className={cn(
              "h-10 rounded-xl border px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              emoji === "" && "border-primary bg-accent text-accent-foreground",
            )}
          >
            {t("noEmoji")}
          </button>
          {PROFILE_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={emoji === e}
              aria-label={e}
              onClick={() => setEmoji(e)}
              className={cn(
                "grid size-10 place-items-center rounded-xl border text-xl transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                emoji === e && "border-primary bg-accent",
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Accent color */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t("accent")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("accent")}>
          {[DEFAULT_ACCENT, ...CATEGORY_COLORS.filter((c) => c !== "#6366F1")].map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={accentValue === c}
              aria-label={c}
              onClick={() => setAccent(c)}
              className={cn(
                "size-9 rounded-full transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                accentValue === c && "ring-2 ring-offset-2 ring-offset-card",
              )}
              style={{ backgroundColor: c, ...(accentValue === c ? { ["--tw-ring-color" as string]: c } : {}) }}
            />
          ))}
          <label
            className={cn(
              "relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full transition-transform focus-within:ring-3 focus-within:ring-ring/50 hover:scale-110",
              customAccent && "ring-2 ring-offset-2 ring-offset-card",
            )}
            style={{
              background: customAccent
                ? accentValue
                : "conic-gradient(#ef4444, #f59e0b, #84cc16, #06b6d4, #6366f1, #ec4899, #ef4444)",
              ...(customAccent ? { ["--tw-ring-color" as string]: accentValue } : {}),
            }}
            title={t("customColor")}
          >
            <span className="sr-only">{t("customColor")}</span>
            <input
              type="color"
              value={accentValue.toLowerCase()}
              onChange={(e) => setAccent(e.target.value.toUpperCase())}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-label={t("customColor")}
            />
          </label>
        </div>
      </fieldset>

      {/* About */}
      <div className="space-y-1.5">
        <Label htmlFor="profile-bio" className="text-sm font-semibold">
          {t("bio")}
        </Label>
        <Textarea
          id="profile-bio"
          value={bio}
          maxLength={BIO_MAX}
          rows={2}
          placeholder={t("bioPlaceholder")}
          onChange={(e) => setBio(e.target.value)}
        />
        <p className="text-right text-xs text-muted-foreground">
          {bio.length}/{BIO_MAX}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-expense-bg px-4 py-3 text-sm font-medium text-expense">
          {tErr(error)}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
