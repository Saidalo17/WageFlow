/** Drizzle wraps driver errors, so the real SQLite message lives somewhere in the `cause` chain. */
function messages(error: unknown): string[] {
  const out: string[] = [];
  let current: unknown = error;
  for (let i = 0; i < 5 && current instanceof Error; i++) {
    out.push(current.message);
    current = (current as Error & { cause?: unknown }).cause;
  }
  return out;
}

export function isUniqueViolation(error: unknown): boolean {
  return messages(error).some((m) => /UNIQUE constraint failed/i.test(m));
}

export function isForeignKeyViolation(error: unknown): boolean {
  return messages(error).some((m) => /FOREIGN KEY constraint failed/i.test(m));
}
