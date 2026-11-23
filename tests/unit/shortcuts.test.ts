import { describe, expect, it } from "vitest";
import { isCommandShortcut } from "@/lib/shortcuts";

const press = (o: Partial<Parameters<typeof isCommandShortcut>[0]>) => isCommandShortcut({ key: "k", code: "KeyK", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, ...o });

describe("Ctrl+K", () => {
  it("works on a Latin layout, in either case", () => {
    expect(press({})).toBe(true);
    expect(press({ key: "K" })).toBe(true);
  });

  it("works on a Russian layout, where the K key types a different letter", () => {
    expect(press({ key: "л" })).toBe(true);
    expect(press({ key: "Л" })).toBe(true);
  });

  it("works with ⌘ on a Mac", () => {
    expect(press({ ctrlKey: false, metaKey: true })).toBe(true);
  });

  it("ignores other keys and other combinations", () => {
    expect(press({ key: "j", code: "KeyJ" })).toBe(false);
    expect(press({ ctrlKey: false })).toBe(false);
    expect(press({ shiftKey: true })).toBe(false);
    expect(press({ altKey: true })).toBe(false);
  });
});
