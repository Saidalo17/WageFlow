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
