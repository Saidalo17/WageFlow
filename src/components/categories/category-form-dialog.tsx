"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createCategory, updateCategory } from "@/app/(app)/categories/actions";
import { CategoryBadge, CategoryIcon } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/responsive-modal";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_COLORS, CATEGORY_ICON_KEYS } from "@/lib/category-meta";
import { cn } from "@/lib/utils";
import type { CategoryItem } from "./types";
import { useCategoryName } from "./use-category-name";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Category being edited, or null to create a new one. */
  category: CategoryItem | null;
  /** Type for a new category. */
  defaultType: "income" | "expense";
};

export function CategoryFormDialog({ open, onOpenChange, category, defaultType }: Props) {
  const t = useTranslations("categories");
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t(category ? "editTitle" : "newTitle")}
    >
      {/* Mounted only while the modal is open, so the form starts fresh every time. */}
      <CategoryForm
        key={category?.id ?? "new"}
        category={category}
        defaultType={defaultType}
        onDone={() => onOpenChange(false)}
      />
    </ResponsiveModal>
  );
}

function CategoryForm({
  category,
  defaultType,
  onDone,
}: {
  category: CategoryItem | null;
  defaultType: "income" | "expense";
  onDone: () => void;
}) {
  const t = useTranslations("categories");
  const tc = useTranslations("common");
  const router = useRouter();
  const displayName = useCategoryName();

  const [name, setName] = useState(category ? displayName(category) : "");
  const [icon, setIcon] = useState<string>(
    category?.icon ?? (defaultType === "income" ? "briefcase" : "shopping-bag"),
  );
  const [color, setColor] = useState<string>(category?.color ?? CATEGORY_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const type = category?.type ?? defaultType;
    const result = category
      ? await updateCategory(category.id, { name, type, color, icon })
      : await createCategory({ name, type, color, icon });
    setSaving(false);
    if (result.ok) {
      toast.success(t(category ? "toasts.updated" : "toasts.created"));
      onDone();
      router.refresh();
    } else {
      setError(result.fieldErrors?.name ?? result.error);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-3">
        <CategoryBadge icon={icon} color={color} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="category-name" className="text-sm font-semibold">
            {t("name")}
          </Label>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? "category-name-error" : undefined}
          />
        </div>
      </div>
      {error && (
        <p id="category-name-error" role="alert" className="-mt-3 text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t("color")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("color")}>
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn(
                "size-9 rounded-full transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                color === c && "ring-2 ring-offset-2 ring-offset-popover",
              )}
              style={{
                backgroundColor: c,
                ...(color === c ? { ["--tw-ring-color" as string]: c } : {}),
              }}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t("icon")}</legend>
        <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label={t("icon")}>
          {CATEGORY_ICON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={icon === key}
              aria-label={key}
              onClick={() => setIcon(key)}
              className={cn(
                "grid aspect-square place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                icon === key && "bg-accent text-accent-foreground ring-1 ring-primary",
              )}
            >
              <CategoryIcon name={key} className="size-5" />
            </button>
          ))}
        </div>
      </fieldset>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t(category ? "save" : "create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
