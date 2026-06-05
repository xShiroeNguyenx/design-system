/**
 * Contrast rule (PLAN §5 "Contrast / a11y"). Theme-kind: checks declared
 * text↔bg TOKEN pairs against WCAG AA in every mode. Pairs are declared data
 * (not inferred) so the ratio math never receives a shadow/alpha token, and so
 * the §11.2 `role: decorative` exemption has a home later.
 */

import { ThemeDefinition } from "../tokens/types.js";
import { createContext, resolveToken } from "../tokens/resolver.js";
import { Finding } from "./types.js";

/** WCAG AA for normal-size text. */
export const AA_NORMAL = 4.5;
/** WCAG AA for large text / UI. */
export const AA_LARGE = 3.0;

export interface ContrastPair {
  fg: string;
  bg: string;
  /** Use the relaxed large-text threshold (3.0) instead of 4.5. */
  large?: boolean;
}

/** Declared pairs for the default semantic model. */
export const CONTRAST_PAIRS: ContrastPair[] = [
  { fg: "color.text.primary", bg: "color.bg.default" },
  { fg: "color.text.primary", bg: "color.bg.subtle" },
  { fg: "color.text.primary", bg: "color.bg.raised" },
  { fg: "color.text.secondary", bg: "color.bg.default" },
  { fg: "color.text.secondary", bg: "color.bg.subtle" },
  { fg: "color.text.secondary", bg: "color.bg.raised" },
  { fg: "color.text.muted", bg: "color.bg.default" },
  { fg: "color.text.muted", bg: "color.bg.subtle" },
  { fg: "color.action.primary.fg", bg: "color.action.primary.bg" },
  { fg: "color.action.secondary.fg", bg: "color.action.secondary.bg" },
  { fg: "color.action.danger.fg", bg: "color.action.danger.bg" },
];

/** Parse #rgb / #rrggbb / #rrggbbaa into [r,g,b] (0–255); throws otherwise. */
export function parseHex(input: string): [number, number, number] {
  const s = input.trim().replace(/^#/, "");
  let hex = s;
  if (s.length === 3) hex = s.split("").map((c) => c + c).join("");
  else if (s.length === 8) hex = s.slice(0, 6); // drop alpha
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`Not a hex color: '${input}'`);
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance per WCAG 2.x. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio (1–21) between two hex colors. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(parseHex(a));
  const lb = relativeLuminance(parseHex(b));
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Round to 2 decimals (stable for assertions). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Run the contrast rule across all declared modes. */
export function checkContrast(theme: ThemeDefinition): Finding[] {
  const ctx = createContext(theme);
  const modes = theme.modes.map((m) => m.name);
  const findings: Finding[] = [];

  for (const mode of modes) {
    for (const pair of CONTRAST_PAIRS) {
      let fgVal: string;
      let bgVal: string;
      try {
        fgVal = String(resolveToken(pair.fg, mode, ctx));
        bgVal = String(resolveToken(pair.bg, mode, ctx));
      } catch {
        continue; // completeness rule reports unresolved tokens
      }
      let ratio: number;
      try {
        ratio = contrastRatio(fgVal, bgVal);
      } catch {
        continue; // non-hex value — not a contrast-checkable pair
      }
      const threshold = pair.large ? AA_LARGE : AA_NORMAL;
      if (ratio < threshold) {
        findings.push({
          ruleId: "contrast-aa",
          severity: "error",
          mode,
          tokenPath: pair.fg,
          message: `Contrast ${round2(ratio)}:1 < AA ${threshold}:1 for ${pair.fg} (${fgVal}) on ${pair.bg} (${bgVal}) in '${mode}'`,
          suggestedFix: `Adjust ${pair.fg} or ${pair.bg} in mode '${mode}' to reach ${threshold}:1.`,
        });
      }
    }
  }
  return findings;
}
