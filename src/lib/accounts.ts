/** Kinds of accounts. Pure (no database), so forms and pages can use it too. */
export const ACCOUNT_KINDS = ["cash", "checking", "savings", "investment", "property", "other"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
