// WCAG 2.x contrast check of the design tokens (see src/app/globals.css and design.md).
// Run: npm run check:contrast. AA needs 4.5:1 for text and 3:1 for UI parts. Keep the values below in sync with globals.css.
// Exits with an error if any pair fails.
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// blends fg with alpha over bg
const mix = (fg, bg, a) => { const f = parseInt(fg.slice(1), 16), b = parseInt(bg.slice(1), 16); const ch = (s) => Math.round(((f >> s) & 255) * a + ((b >> s) & 255) * (1 - a)); return "#" + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join(""); };

const themes = {
  light: { bg: "#f3f5f8", card: "#ffffff", fg: "#101827", muted: "#5b6577", primary: "#0a9a6c", primaryStrong: "#046c4e", primaryFg: "#04261d", accent: "#dff5ec", accentFg: "#065f46", income: "#047857", incomeBg: "#d8f3e7", expense: "#b91c1c", expenseBg: "#fde2e2", warning: "#b45309", secondary: "#eaeef3", link: "#046c4e", mutedBg: "#eaeef3", gold: "#d6b56d", goldText: "#7a5c14", goldFg: "#101827", heroFrom: "#0d7a5f", heroTo: "#0b3b4a" },
  dark: { bg: "#0a101c", card: "#101827", fg: "#f3f5f8", muted: "#9aa6ba", primary: "#12b981", primaryStrong: "#34d399", link: "#34d399", primaryFg: "#04261d", accent: "#0f2d2a", accentFg: "#6ee7b7", income: "#34d399", incomeBg: "#0b2b25", expense: "#f87171", expenseBg: "#3a1417", warning: "#fbbf24", secondary: "#162036", mutedBg: "#162036", gold: "#d6b56d", goldText: "#e3c98f", goldFg: "#101827", heroFrom: "#0d7a5f", heroTo: "#0b3b4a" },
};

const rows = [];
for (const [name, t] of Object.entries(themes)) {
  const pairs = [
    ["text on page", t.fg, t.bg, 4.5], ["text on card", t.fg, t.card, 4.5],
    ["muted text on page", t.muted, t.bg, 4.5], ["muted text on card", t.muted, t.card, 4.5], ["muted text on muted bg", t.muted, t.mutedBg, 4.5],
    ["solid primary text", t.primaryFg, t.primary, 4.5], ["glass primary button text on card", t.primaryStrong, mix(t.primary, t.card, 0.14), 4.5], ["glass primary button text on page", t.primaryStrong, mix(t.primary, t.bg, 0.14), 4.5], ["gold text on card", t.goldText, t.card, 4.5], ["text on gold fill", t.goldFg, t.gold, 4.5], ["link on card", t.link, t.card, 4.5], ["link on page", t.link, t.bg, 4.5], ["primary button vs card [UI 3:1]", t.primary, t.card, 3],
    ["active nav (accentFg on accent)", t.accentFg, t.accent, 4.5],
    ["income on card", t.income, t.card, 4.5], ["income on income-bg", t.income, t.incomeBg, 4.5],
    ["expense on card", t.expense, t.card, 4.5], ["expense on expense-bg", t.expense, t.expenseBg, 4.5],
    ["warning text on card", t.warning, t.card, 4.5],
    ["warning on warning/15% plate", t.fg, mix(t.warning, t.card, 0.15), 4.5],
    ["hero gradient text (start)", "#ffffff", t.heroFrom, 4.5], ["hero gradient text (end)", "#ffffff", t.heroTo, 4.5],
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
