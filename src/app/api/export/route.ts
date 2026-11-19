import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { isLocale } from "@/i18n/config";
import { fromMinor, minorDigits } from "@/lib/money";
import { todayISO } from "@/lib/format";
import { isRealDate } from "@/lib/period";
import { exportTransactions } from "@/lib/services/transactions";

/**
 * GET /api/export?from=YYYY-MM-DD&to=YYYY-MM-DD  (both optional)
 * Returns the signed-in user's own transactions as a CSV file. Nobody else's data can be requested.
 */

/** A cell that starts with = + - @ could run as a formula in Excel, so it gets a leading apostrophe. */
function cell(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;
  if ((from && !isRealDate(from)) || (to && !isRealDate(to)) || (from && to && from > to)) {
    return NextResponse.json({ error: "invalid range" }, { status: 400 });
  }

  const [user] = await db
    .select({ currency: users.currency, locale: users.locale })
    .from(users)
    .where(eq(users.id, session.user.id));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Standard categories are exported with their translated names, like in the app.
  const locale = isLocale(user.locale) ? user.locale : "en";
  const messages = (await import(`../../../messages/${locale}.json`)).default as {
    categories: { system: Record<string, string> };
  };

  const rows = await exportTransactions(session.user.id, { from, to });
  const digits = minorDigits(user.currency);

  const lines = ["date,type,category,amount,currency,note"];
  for (const r of rows) {
    const category = r.categorySystemKey
      ? (messages.categories.system[r.categorySystemKey] ?? r.categoryName)
      : r.categoryName;
    lines.push(
      [
        r.occurredOn,
        r.type,
        cell(category),
        // Plain number with a dot, no thousands separators: easy for Excel and scripts to read.
        fromMinor(r.amount, user.currency).toFixed(digits),
        user.currency,
        cell(r.note ?? ""),
      ].join(","),
    );
  }

  // The BOM makes Excel open the file as UTF-8, so Cyrillic and Chinese stay readable.
  const body = "﻿" + lines.join("\r\n") + "\r\n";
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="salary-${todayISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
