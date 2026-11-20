import { describe, expect, it } from "vitest";
import { detectImageType } from "@/lib/avatar";
import { BIO_MAX, PROFILE_EMOJIS } from "@/lib/profile-meta";
import { decorationSchema } from "@/lib/validators/settings";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(20).fill(0)]);

describe("profile photo type check", () => {
  it("accepts JPEG, PNG and WebP by their first bytes", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    const webp = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
    expect(detectImageType(webp)).toBe("image/webp");
  });
  it("refuses everything else, including SVG, HTML, GIF and tiny files", () => {
    const text = (s: string) => new TextEncoder().encode(s.padEnd(40, " "));
    expect(detectImageType(text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(detectImageType(text("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(detectImageType(text("GIF89a"))).toBeNull();
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

describe("profile decoration", () => {
  it("accepts a short text, a known emoji and a hex color; empty means not set", () => {
    expect(decorationSchema.parse({ bio: "  Saving for a trip ", emoji: "🚀", accent: "#abcdef" })).toEqual({
      bio: "Saving for a trip",
      emoji: "🚀",
      accent: "#ABCDEF",
    });
    expect(decorationSchema.parse({ bio: "", emoji: "", accent: "" })).toEqual({ bio: null, emoji: null, accent: null });
  });
  it("rejects a long text, an unknown emoji and a bad color", () => {
    expect(decorationSchema.safeParse({ bio: "a".repeat(BIO_MAX + 1), emoji: "", accent: "" }).success).toBe(false);
    expect(decorationSchema.safeParse({ bio: "a".repeat(BIO_MAX), emoji: "", accent: "" }).success).toBe(true);
    expect(decorationSchema.safeParse({ bio: "", emoji: "<script>", accent: "" }).success).toBe(false);
    for (const accent of ["red", "#12345", "url(x)", "#GGGGGG"]) {
      expect(decorationSchema.safeParse({ bio: "", emoji: "", accent }).success, accent).toBe(false);
    }
  });
  it("offers a sensible set of emojis", () => {
    expect(new Set(PROFILE_EMOJIS).size).toBe(PROFILE_EMOJIS.length);
  });
});
