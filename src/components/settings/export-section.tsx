"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Downloads the user's own transactions as a CSV file, optionally for a date range. */
export function ExportSection() {
  const t = useTranslations("settings.export");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalid = !!from && !!to && from > to;

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{t("description")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="exp-from" className="text-sm font-semibold">
            {t("from")}
          </Label>
          <Input id="exp-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-to" className="text-sm font-semibold">
            {t("to")}
          </Label>
          <Input id="exp-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
        {/* A plain link: the browser downloads the file, signed in with the session cookie. */}
        <a
          href={invalid ? undefined : `/api/export${qs ? `?${qs}` : ""}`}
          aria-disabled={invalid}
          className={buttonVariants({ variant: "secondary" }) + (invalid ? " pointer-events-none opacity-50" : "")}
        >
          <Download className="size-4" />
          {t("button")}
        </a>
      </div>
      <p className="text-sm text-muted-foreground">{invalid ? t("invalidRange") : t("hint")}</p>
    </div>
  );
}
