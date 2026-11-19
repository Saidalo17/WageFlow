// WCAG 2.x contrast check of the design tokens (see src/app/globals.css and design.md).
// Run: npm run check:contrast. AA needs 4.5:1 for text and 3:1 for UI parts. Keep the values below in sync with globals.css.
// Exits with an error if any pair fails.
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// blends fg with alpha over bg
const mix = (fg, bg, a) => { const f = parseInt(fg.slice(1), 16), b = parseInt(bg.slice(1), 16); const ch = (s) => Math.round(((f >> s) & 255) * a + ((b >> s) & 255) * (1 - a)); return "#" + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join(""); };

const themes = {
  light: { bg: "#f7f7fb", card: "#ffffff", fg: "#14142b", muted: "#6b6b80", primary: "#4f46e5", primaryFg: "#ffffff", accent: "#eef2ff", accentFg: "#4338ca", income: "#15803d", incomeBg: "#dcfce7", expense: "#b91c1c", expenseBg: "#fee2e2", warning: "#b45309", secondary: "#f1f1f7", violet: "#7c3aed", link: "#4f46e5", mutedBg: "#f1f1f7" },
  dark: { bg: "#0e0e16", card: "#17171f", fg: "#f2f2f8", muted: "#9a9aaf", primary: "#5b5ef0", link: "#818cf8", primaryFg: "#ffffff", accent: "#1e1b4b", accentFg: "#a5b4fc", income: "#4ade80", incomeBg: "#052e16", expense: "#f87171", expenseBg: "#450a0a", warning: "#fbbf24", secondary: "#1f1f2a", violet: "#7c3aed", mutedBg: "#1f1f2a" },
};

const rows = [];
for (const [name, t] of Object.entries(themes)) {
  const pairs = [
    ["text on page", t.fg, t.bg, 4.5], ["text on card", t.fg, t.card, 4.5],
    ["muted text on page", t.muted, t.bg, 4.5], ["muted text on card", t.muted, t.card, 4.5], ["muted text on muted bg", t.muted, t.mutedBg, 4.5],
    ["primary button text", t.primaryFg, t.primary, 4.5], ["link on card", t.link, t.card, 4.5], ["link on page", t.link, t.bg, 4.5], ["primary button vs card [UI 3:1]", t.primary, t.card, 3],
    ["active nav (accentFg on accent)", t.accentFg, t.accent, 4.5],
    ["income on card", t.income, t.card, 4.5], ["income on income-bg", t.income, t.incomeBg, 4.5],
    ["expense on card", t.expense, t.card, 4.5], ["expense on expense-bg", t.expense, t.expenseBg, 4.5],
    ["warning text on card", t.warning, t.card, 4.5],
    ["warning on warning/15% plate", t.fg, mix(t.warning, t.card, 0.15), 4.5],
    ["gradient card text (start)", "#ffffff", name === "light" ? "#4f46e5" : "#4f46e5", 4.5], ["gradient card text (end, violet)", "#ffffff", t.violet, 4.5],
    ["budget bar (primary) vs card [UI 3:1]", t.primary, t.card, 3], ["budget bar warning vs card [UI 3:1]", t.warning, t.card, 3], ["budget bar expense vs card [UI 3:1]", t.expense, t.card, 3],
  ];
  for (const [label, fg, bg, min] of pairs) {
    const r = ratio(fg, bg);
    rows.push({ theme: name, label, fg, bg, ratio: r.toFixed(2), min, ok: r >= min });
  }
}
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.theme.padEnd(5)} ${r.label.padEnd(40)} ${r.fg} on ${r.bg}  ${r.ratio} (min ${r.min})`);
console.log("\nfailing:", rows.filter((r) => !r.ok).length);
if (rows.some((r) => !r.ok)) process.exit(1);
