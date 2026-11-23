import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
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
  /** Raised when the password changes: every session issued before that stops working. */
  sessionVersion: integer("session_version").notNull().default(0),
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
    /** Position chosen by dragging; categories with the same value keep their creation order. */
    sortOrder: integer("sort_order").notNull().default(0),
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
    /** The account the money moved on, if the user said so. Deleting an account keeps its transactions. */
    accountId: text("account_id").references((): AnySQLiteColumn => accounts.id, { onDelete: "set null" }),
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
    index("transactions_user_account").on(t.userId, t.accountId),
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

/**
 * A place where money is kept: cash, a bank account or card, savings, investments, property...
 * The balance is not stored: it is the opening balance plus the transactions linked to the account
 * (counted in the account's own currency), so it can never drift away from the operations.
 */
export const accounts = sqliteTable(
  "accounts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["cash", "checking", "savings", "investment", "property", "other"] }).notNull(),
    /** Currency of the account (any ISO currency). */
    currency: text("currency").notNull(),
    /** What was on the account before the first linked transaction, minor units of `currency`. Can be negative. */
    openingBalance: integer("opening_balance").notNull().default(0),
    /** Whether the account counts in the net worth. */
    inNetWorth: integer("in_net_worth", { mode: "boolean" }).notNull().default(true),
    isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("accounts_user").on(t.userId)],
);

/**
 * A loan, credit card, mortgage or a personal debt, in either direction.
 * `principal` is the original amount; the remaining amount is the principal minus the payments.
 */
export const debts = sqliteTable(
  "debts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** owed_by_me: I owe (a liability). owed_to_me: somebody owes me (an asset). */
    direction: text("direction", { enum: ["owed_by_me", "owed_to_me"] }).notNull(),
    kind: text("kind", { enum: ["loan", "credit_card", "mortgage", "personal", "other"] }).notNull(),
    currency: text("currency").notNull(),
    principal: integer("principal").notNull(),
    /** Yearly interest in hundredths of a percent (12.5% = 1250); 0 when there is none. */
    interestRate: integer("interest_rate").notNull().default(0),
    /** The usual payment per month, minor units; used for the payoff estimate. */
    monthlyPayment: integer("monthly_payment"),
    /** Day of the month the payment is due, 1-31. */
    paymentDay: integer("payment_day"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("debts_user").on(t.userId)],
);

export const debtPayments = sqliteTable(
  "debt_payments",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    debtId: text("debt_id")
      .notNull()
      .references(() => debts.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD */
    paidOn: text("paid_on").notNull(),
    /** Minor units of the debt's currency; always > 0. */
    amount: integer("amount").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("debt_payments_user_debt").on(t.userId, t.debtId)],
);

/** One row per day the net worth page was opened: the history behind the net worth chart. */
export const netWorthSnapshots = sqliteTable(
  "net_worth_snapshots",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD */
    date: text("date").notNull(),
    /** The currency the three amounts are in (the user's main currency when it was taken). */
    currency: text("currency").notNull(),
    assets: integer("assets").notNull(),
    liabilities: integer("liabilities").notNull(),
    netWorth: integer("net_worth").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("net_worth_snapshots_user_date").on(t.userId, t.date)],
);
