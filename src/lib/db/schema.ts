import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  currency: text("currency").notNull().default("USD"),
  locale: text("locale").notNull().default("en"),
  monthStartDay: integer("month_start_day").notNull().default(1),
  /** Country whose tax rules the salary calculator applies by default (ISO 3166 alpha-2), or null for none. */
  country: text("country"),
  /** When the user last opened the overview (ms). Used for the "welcome back" greeting. */
  lastSeenAt: integer("last_seen_at"),
  /** Profile photo: base64 of a small (<= 200 KB) JPEG/PNG/WebP, plus its type and when it was set. */
  avatar: text("avatar"),
  avatarMime: text("avatar_mime"),
  avatarUpdatedAt: integer("avatar_updated_at"),
  /** Profile decoration: short text about the user, an emoji shown when there is no photo, and an accent color (#RRGGBB). */
  bio: text("bio"),
  emoji: text("emoji"),
  accent: text("accent"),
  createdAt: createdAt(),
});

export const categories = sqliteTable(
  "categories",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    color: text("color").notNull(),
    icon: text("icon").notNull(),
    isArchived: integer("is_archived", { mode: "boolean" })
      .notNull()
      .default(false),
    systemKey: text("system_key"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("categories_user_type_name").on(t.userId, t.type, t.name)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    /** Amount in minor units of the user's currency (cents, kopecks...). Always > 0. */
    amount: integer("amount").notNull(),
    /**
     * What the user actually typed: amount (minor units) and currency. `amount` above is this value
     * converted into the user's current currency, so totals and charts need no conversion.
     * Keeping the original lets us switch currencies back and forth without losing precision.
     */
    originalAmount: integer("original_amount"),
    originalCurrency: text("original_currency"),
    /** Date as YYYY-MM-DD */
    occurredOn: text("occurred_on").notNull(),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("transactions_user_date").on(t.userId, t.occurredOn),
    index("transactions_user_category").on(t.userId, t.categoryId),
  ],
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    limitAmount: integer("limit_amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("budgets_user_category").on(t.userId, t.categoryId)],
);

/** Failed sign-in attempts, used for rate limiting (5 per 15 minutes). */
export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: id(),
    /** "email:<address>" or "ip:<address>" */
    key: text("key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_key_time").on(t.key, t.createdAt)],
);

/**
 * A saved salary calculation. Amounts are minor units of `currency` (the user's main currency when it was saved)
 * and are never converted afterwards: a payslip stays what it was. Hours, days and the multiplier are stored in
 * hundredths (160.5 h = 16050, 1.5x = 150), a percentage deduction in hundredths of a percent (13% = 1300).
 */
export const salaryRecords = sqliteTable(
  "salary_records",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    /** Country whose tax rules were applied when it was saved, or null when deductions were entered by hand. */
    country: text("country"),
    title: text("title"),
    /** Date the salary is (or was) paid, YYYY-MM-DD */
    payDate: text("pay_date").notNull(),
    mode: text("mode", { enum: ["monthly", "hourly", "daily"] }).notNull(),
    /** Monthly salary, hourly rate or daily rate, depending on `mode`. */
    rate: integer("rate").notNull(),
    /** Hours (hourly) or days (daily) worked, in hundredths. 0 for monthly. */
    quantity: integer("quantity").notNull().default(0),
    /** Standard hours in a month / in a day, in hundredths; used to derive an hourly rate. */
    monthHours: integer("month_hours").notNull().default(16000),
    dayHours: integer("day_hours").notNull().default(800),
    overtimeHours: integer("overtime_hours").notNull().default(0),
    overtimeMultiplier: integer("overtime_multiplier").notNull().default(150),
    /** JSON array of { label, kind: "percent" | "fixed", value }. */
    deductions: text("deductions").notNull().default("[]"),
    /** Result of the calculation when it was saved. */
    basePay: integer("base_pay").notNull(),
    overtimePay: integer("overtime_pay").notNull().default(0),
    bonusTotal: integer("bonus_total").notNull().default(0),
    gross: integer("gross").notNull(),
    deductionTotal: integer("deduction_total").notNull().default(0),
    net: integer("net").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("salary_records_user_date").on(t.userId, t.payDate)],
);

/** Bonuses and premiums that belong to a salary calculation (the "history of bonuses"). */
export const salaryBonuses = sqliteTable(
  "salary_bonuses",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recordId: text("record_id")
      .notNull()
      .references(() => salaryRecords.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    amount: integer("amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("salary_bonuses_user_record").on(t.userId, t.recordId)],
);


/**
 * When a salary is expected and how much. Drives the payment planner, the in-app reminders and the calendar export.
 * Amounts are minor units of `currency` (the user's main currency when it was saved), like saved calculations.
 */
export const salarySchedules = sqliteTable(
  "salary_schedules",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    title: text("title").notNull(),
    frequency: text("frequency", { enum: ["monthly", "biweekly", "weekly"] }).notNull(),
    /** monthly: day of the month, 1-31 (the last day when the month is shorter). */
    dayOfMonth: integer("day_of_month").notNull().default(1),
    /** weekly / biweekly: any date the payments fall on, YYYY-MM-DD. */
    anchorDate: text("anchor_date"),
    /** Expected net pay for one payment. */
    expectedNet: integer("expected_net").notNull(),
    /** Show a reminder this many days before the payment (0 = on the day). */
    remindDaysBefore: integer("remind_days_before").notNull().default(1),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("salary_schedules_user").on(t.userId)],
);
