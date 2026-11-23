"use client";

import { CheckCircle2, FileUp, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { analyzeImport, commitImport } from "@/app/(app)/transactions/import/actions";
import { Card } from "@/components/card";
import { useCategoryName } from "@/components/categories/use-category-name";
import type { AccountChoice, CategoryOption } from "@/components/transactions/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  guessDateOrder,
  guessMapping,
  hasHeaderRow,
  NO_COLUMN,
  parseRows,
  type ColumnMapping,
  type DateOrder,
} from "@/lib/import/columns";
import { decodeBytes, parseCsv } from "@/lib/import/csv";
import { formatDate } from "@/lib/format";
import { formatMoney, toMinor } from "@/lib/money";
import { IMPORT_BATCH } from "@/lib/validators/import";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;
/** Rows drawn at first and per "show more": a long statement never builds thousands of fields at once. */
const PAGE_ROWS = 100;

type Stage = "upload" | "map" | "review" | "done";

type ReviewRow = {
  key: number;
  date: string;
  description: string;
  /** Signed, minor units. */
  amount: number;
  categoryId: string;
  source: "history" | "keywords" | "default";
  duplicate: boolean;
  include: boolean;
};

const ROLES = ["date", "description", "amount", "debit", "credit"] as const;
const ROLE_KEY = { date: "colDate", description: "colDescription", amount: "colAmount", debit: "colDebit", credit: "colCredit" } as const;

export function ImportWizard({ categories, accounts, currency }: { categories: CategoryOption[]; accounts: AccountChoice[]; currency: string }) {
  const t = useTranslations("import");
  const locale = useLocale();
  const categoryName = useCategoryName();
  const fileInput = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState("");
  const [raw, setRaw] = useState<string[][]>([]);
  const [header, setHeader] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping>({ date: NO_COLUMN, description: NO_COLUMN, amount: NO_COLUMN, debit: NO_COLUMN, credit: NO_COLUMN });
  const [order, setOrder] = useState<DateOrder>("dmy");
  const [review, setReview] = useState<ReviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [visible, setVisible] = useState(PAGE_ROWS);
  const [accountId, setAccountId] = useState("");

  const width = Math.max(0, ...raw.slice(0, 20).map((r) => r.length));
  const columnLabel = (i: number) => (header && raw[0]?.[i] ? raw[0][i] : t("columnN", { n: i + 1 }));
  const parsed = useMemo(() => parseRows(raw, mapping, header, order, locale), [raw, mapping, header, order, locale]);
  const money = (minor: number) => formatMoney(Math.abs(minor), currency, locale);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) return setError("tooBig");
    const rows = parseCsv(decodeBytes(new Uint8Array(await file.arrayBuffer())));
    if (rows.length < 2) return setError("emptyFile");

    const hasHeader = hasHeaderRow(rows);
    const guessed = guessMapping(rows, hasHeader, locale);
    const samples = guessed.date === NO_COLUMN ? [] : rows.slice(hasHeader ? 1 : 0, 60).map((r) => r[guessed.date] ?? "");
    setFileName(file.name);
    setRaw(rows);
    setHeader(hasHeader);
    setMapping(guessed);
    setOrder(guessDateOrder(samples, locale === "en" ? "mdy" : "dmy"));
    setStage("map");
  }

  function changeHeader(value: boolean) {
    setHeader(value);
    setMapping(guessMapping(raw, value, locale));
  }

  async function analyze() {
    setError(null);
    if (parsed.rows.length === 0) return setError("noRows");
    if (parsed.rows.length > MAX_ROWS) return setError("tooManyRows");

    const rows = parsed.rows
      .map((r) => ({ date: r.date, description: r.description, amount: Math.sign(r.amount) * toMinor(Math.abs(r.amount), currency) }))
      .filter((r) => r.amount !== 0);
    if (rows.length === 0) return setError("noRows");

    setBusy(true);
    const out: ReviewRow[] = [];
    for (let i = 0; i < rows.length; i += IMPORT_BATCH) {
      const chunk = rows.slice(i, i + IMPORT_BATCH);
      const result = await analyzeImport(chunk);
      if (!result.ok) {
        setBusy(false);
        return setError(result.error);
      }
      chunk.forEach((r, j) => {
        const a = result.items[j];
        out.push({ key: i + j, ...r, categoryId: a.categoryId, source: a.source, duplicate: a.duplicate, include: !a.duplicate });
      });
    }
    setBusy(false);
    setReview(out);
    setVisible(PAGE_ROWS);
    setStage("review");
  }

  async function save() {
    setError(null);
    const chosen = review.filter((r) => r.include);
    if (chosen.length === 0) return;
    setBusy(true);
    let count = 0;
    for (let i = 0; i < chosen.length; i += IMPORT_BATCH) {
      const result = await commitImport(
        chosen.slice(i, i + IMPORT_BATCH).map((r) => ({
          date: r.date,
          note: r.description.slice(0, 200),
          amount: Math.abs(r.amount),
          type: r.amount > 0 ? "income" : "expense",
          categoryId: r.categoryId,
          accountId: accountId || null,
        })),
      );
      if (!result.ok) {
        setBusy(false);
        // Part of the file may already be saved: say so, and never repeat the saved part.
        if (count > 0) toast.error(t("partial", { count }));
        return setError(result.error);
      }
      count += result.count;
    }
    setBusy(false);
    setImported(count);
    setStage("done");
  }

  const update = (key: number, patch: Partial<ReviewRow>) =>
    setReview((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const chosen = review.filter((r) => r.include);
  const income = chosen.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const expense = chosen.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);

  const errorBox = error && (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-expense-bg px-4 py-3 text-sm font-medium text-expense">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      {t(`errors.${error}`)}
    </p>
  );

  const steps: Stage[] = ["upload", "map", "review", "done"];

  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <div className="relative isolate space-y-1 overflow-hidden rounded-3xl p-6 text-white shadow-[var(--shadow-card)]">
        <Image src="/hero.png" alt="" fill sizes="960px" className="-z-20 object-cover" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(11,18,32,0.94),rgba(11,18,32,0.7)_55%,rgba(11,18,32,0.35))]" />
        <h1 className="text-[28px] font-extrabold tracking-tight">{t("title")}</h1>
        <p className="max-w-xl text-white/80">{t("subtitle")}</p>
        <ol className="flex flex-wrap gap-2 pt-2 text-xs font-semibold text-white/80" aria-label={t("steps")}>
          {steps.map((s, i) => (
            <li key={s} aria-current={s === stage ? "step" : undefined} className={cn("rounded-full px-3 py-1", s === stage ? "bg-primary text-primary-foreground" : "bg-white/15")}>
              {i + 1}. {t(`step.${s}`)}
            </li>
          ))}
        </ol>
      </div>

      {stage === "upload" && (
        <Card title={t("uploadTitle")} index={1}>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void onFile(e.dataTransfer.files[0]);
            }}
            className={cn("grid place-items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors", dragging && "border-primary bg-accent")}
          >
            <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
              <FileUp className="size-6" />
            </span>
            <p className="max-w-md text-sm text-muted-foreground">{t("uploadHint")}</p>
            <input ref={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} aria-label={t("choose")} />
            <Button onClick={() => fileInput.current?.click()}>{t("choose")}</Button>
            <p className="text-xs text-muted-foreground">{t("dropHere")}</p>
          </div>
          {error && <div className="mt-4">{errorBox}</div>}
        </Card>
      )}

      {stage === "map" && (
        <Card title={t("mapTitle")} index={1}>
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">{t("fileLabel", { name: fileName })}</p>

            <label className="flex items-center gap-3 text-sm font-medium">
              <input type="checkbox" checked={header} onChange={(e) => changeHeader(e.target.checked)} className="size-5 rounded accent-[var(--primary)]" />
              {t("firstRowHeader")}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              {ROLES.map((role) => (
                <div key={role} className="space-y-1.5">
                  <Label htmlFor={`map-${role}`} className="text-sm font-semibold">
                    {t(ROLE_KEY[role])}
                  </Label>
                  <NativeSelect id={`map-${role}`} value={mapping[role]} onChange={(e) => setMapping((m) => ({ ...m, [role]: Number(e.target.value) }))}>
                    <option value={NO_COLUMN}>{t("none")}</option>
                    {Array.from({ length: width }, (_, i) => (
                      <option key={i} value={i}>
                        {columnLabel(i)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="map-order" className="text-sm font-semibold">
                  {t("dateFormat")}
                </Label>
                <NativeSelect id="map-order" value={order} onChange={(e) => setOrder(e.target.value as DateOrder)}>
                  {(["dmy", "mdy", "ymd"] as const).map((o) => (
                    <option key={o} value={o}>
                      {t(`formats.${o}`)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{t("amountHint")}</p>

            {/* The first rows as they are in the file */}
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full text-sm">
                <tbody>
                  {raw.slice(0, 6).map((r, i) => (
                    <tr key={i} className={cn("border-b last:border-0", header && i === 0 && "bg-muted font-semibold")}>
                      {Array.from({ length: width }, (_, c) => (
                        <td key={c} className="max-w-[220px] truncate px-3 py-2 whitespace-nowrap">
                          {r[c] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-sm">
              <p className="font-semibold">{t("recognized", { count: parsed.rows.length })}</p>
              {parsed.skipped > 0 && <p className="text-muted-foreground">{t("skippedRows", { count: parsed.skipped })}</p>}
              <p className="text-muted-foreground">{t("currencyNote", { currency })}</p>
            </div>

            {errorBox}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => { setStage("upload"); setError(null); }}>
                {t("back")}
              </Button>
              <Button onClick={analyze} disabled={busy || parsed.rows.length === 0} className="gap-1.5">
                {busy && <Loader2 className="size-4 animate-spin" />}
                {t("next")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {stage === "review" && (
        <Card title={t("reviewTitle")} index={1}>
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">{t("reviewHint")}</p>

            {accounts.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="imp-account" className="text-sm font-semibold">
                  {t("account")}
                </Label>
                <NativeSelect id="imp-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">{t("noAccount")}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-sm text-muted-foreground">{t("accountHint", { currency })}</p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-sm text-muted-foreground">{t("incomeTotal")}</p>
                <p className="amount text-xl font-extrabold text-income">+{money(income)}</p>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-sm text-muted-foreground">{t("expenseTotal")}</p>
                <p className="amount text-xl font-extrabold text-expense">−{money(expense)}</p>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-sm text-muted-foreground">{t("selected", { count: chosen.length })}</p>
                <div className="mt-1 flex gap-2 text-sm font-semibold">
                  <button type="button" className="text-link hover:underline" onClick={() => setReview((rows) => rows.map((r) => ({ ...r, include: true })))}>
                    {t("selectAll")}
                  </button>
                  <button type="button" className="text-link hover:underline" onClick={() => setReview((rows) => rows.map((r) => ({ ...r, include: false })))}>
                    {t("selectNone")}
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b bg-muted text-left text-xs font-semibold text-muted-foreground">
                    <th className="w-10 px-3 py-2">
                      <span className="sr-only">{t("colInclude")}</span>
                    </th>
                    <th className="px-3 py-2">{t("colDate")}</th>
                    <th className="px-3 py-2">{t("colDescription")}</th>
                    <th className="px-3 py-2 text-right">{t("amountShort")}</th>
                    <th className="px-3 py-2">{t("colCategory")}</th>
                  </tr>
                </thead>
                <tbody>
                  {review.slice(0, visible).map((r) => {
                    const type = r.amount > 0 ? "income" : "expense";
                    const options = categories.filter((c) => c.type === type && !c.isArchived);
                    return (
                      <tr key={r.key} className={cn("border-b last:border-0", !r.include && "opacity-55")}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} aria-label={`${t("colInclude")}: ${r.description || r.date}`} className="size-5 rounded accent-[var(--primary)]" />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.date, locale, { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td className="max-w-[260px] px-3 py-2">
                          <p className="truncate">{r.description || "—"}</p>
                          {r.duplicate && (
                            <p className="text-xs font-semibold text-warning">{t("duplicate")}</p>
                          )}
                        </td>
                        <td className={cn("amount px-3 py-2 text-right font-semibold whitespace-nowrap", r.amount > 0 ? "text-income" : "text-expense")}>
                          {r.amount > 0 ? "+" : "−"}
                          {money(r.amount)}
                        </td>
                        <td className="min-w-[180px] px-3 py-2">
                          <NativeSelect aria-label={`${t("colCategory")}: ${r.description || r.date}`} value={r.categoryId} onChange={(e) => update(r.key, { categoryId: e.target.value, source: "history" })} className="h-10">
                            {options.map((c) => (
                              <option key={c.id} value={c.id}>
                                {categoryName(c)}
                              </option>
                            ))}
                          </NativeSelect>
                          {r.source === "history" && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Sparkles className="size-3" />
                              {t("learned")}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {review.length > visible && (
              <Button variant="secondary" className="w-full max-sm:h-10" onClick={() => setVisible((v) => v + PAGE_ROWS * 2)}>
                {t("showMore", { count: review.length - visible })}
              </Button>
            )}

            {errorBox}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => { setStage("map"); setError(null); }} disabled={busy}>
                {t("back")}
              </Button>
              <Button onClick={save} disabled={busy || chosen.length === 0} className="gap-1.5">
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy ? t("importing") : t("importBtn", { count: chosen.length })}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {stage === "done" && (
        <Card index={1}>
          <div className="grid place-items-center gap-3 px-2 py-8 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-income-bg text-income">
              <CheckCircle2 className="size-7" />
            </span>
            <h2 className="text-xl font-extrabold">{t("doneTitle")}</h2>
            <p className="text-muted-foreground">{t("doneBody", { count: imported })}</p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Link href="/transactions" className={buttonVariants()}>
                {t("viewTransactions")}
              </Link>
              <Button variant="secondary" onClick={() => { setStage("upload"); setRaw([]); setReview([]); setError(null); if (fileInput.current) fileInput.current.value = ""; }}>
                {t("another")}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
