// Computes WCAG contrast ratios for the colour pairs used in src/tokens.css.
// Usage: node scripts/check-contrast.mjs   (exit code 1 if a pair fails AA)
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
const color = (name) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
};

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum ratio, description]
const pairs = [
  ['ink', 'paper', 4.5, 'body text on page'],
  ['ink', 'surface', 4.5, 'body text on cards'],
  ['ink-2', 'paper', 4.5, 'muted text on page'],
  ['ink-2', 'surface', 4.5, 'muted text on cards'],
  ['ink-2', 'surface-2', 4.5, 'muted text on tinted areas'],
  ['accent', 'paper', 4.5, 'links on page'],
  ['accent', 'surface', 4.5, 'links on cards'],
  ['accent-strong', 'paper', 4.5, 'link hover on page'],
  ['on-accent', 'accent', 4.5, 'primary button label'],
  ['on-accent', 'accent-strong', 4.5, 'primary button hover label'],
  ['accent-strong', 'accent-soft', 4.5, 'accent text on soft tint'],
  ['critical', 'critical-soft', 4.5, 'critical label'],
  ['major-ink', 'major-soft', 4.5, 'major label'],
  ['minor', 'minor-soft', 4.5, 'minor label'],
  ['computed', 'computed-soft', 4.5, 'computed badge'],
  ['ai', 'ai-soft', 4.5, 'AI badge'],
  ['critical', 'surface', 4.5, 'critical text on cards'],
  ['major-ink', 'surface', 4.5, 'major text on cards'],
  ['minor', 'surface', 4.5, 'minor text on cards'],
  // graphics only need 3:1
  ['accent', 'surface', 3, 'focus ring / graphic accent'],
  ['major', 'surface', 3, 'major bar fill'],
  ['critical', 'surface', 3, 'critical bar fill'],
  ['minor', 'surface', 3, 'minor bar fill'],
  ['field-border', 'surface', 3, 'input and control borders (WCAG 1.4.11)'],
];

let failed = 0;
for (const [fg, bg, min, what] of pairs) {
  const r = ratio(color(fg), color(bg));
  const ok = r >= min;
  if (!ok) failed++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2)}:1 (min ${min})  --${fg} on --${bg}  ${what}`,
  );
}
process.exit(failed ? 1 : 0);
