/**
 * Ctrl+K / ⌘K opens the command center. The physical key is checked as well as the letter:
 * on a Russian (or any non-Latin) layout the K key types "л", so `event.key` alone never says "k".
 */
export function isCommandShortcut(e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return false;
  return e.code === "KeyK" || e.key.toLowerCase() === "k";
}
