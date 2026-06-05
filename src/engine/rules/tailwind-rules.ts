/**
 * Tailwind code-kind rules (PLAN §5, stack tailwind). Tailwind styling lives in
 * markup className strings, NOT in CSS — so these are className SCANNERS, not
 * postcss passes. (Running the css-vars selector rules on a Tailwind project
 * would find zero `.btn:hover` selectors and "pass" vacuously — which is exactly
 * why `appliesTo` is load-bearing and these are separate detectors.)
 *
 *  - no-raw-class: raw palette utilities (`bg-blue-500`) or arbitrary color
 *    values (`bg-[#fff]`) in markup; use semantic preset utilities.
 *  - interactive-completeness-tailwind: interactive elements must declare their
 *    required state VARIANTS (`hover:`/`active:`/`focus-visible:`/`disabled:`),
 *    element-type-aware (text inputs: no active; links: no disabled).
 */

import { Finding, SourceFile } from "./types.js";

const MARKUP_EXT = [".html", ".htm", ".jsx", ".tsx", ".vue", ".svelte", ".astro"];
const IGNORE_RE = /dsmcp-ignore\s+interactive-completeness/;

const TW_PALETTE =
  /(?:[a-z-]+:)*(bg|text|border|ring|ring-offset|from|via|to|fill|stroke|outline|decoration|divide|placeholder|caret|accent|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\d{2,3})\b/g;

const TW_ARBITRARY_COLOR =
  /(?:[a-z-]+:)*(bg|text|border|ring|fill|stroke|outline|caret|accent|decoration|placeholder)-\[\s*(#|rgb|hsl)[^\]]*\]/gi;

function isMarkup(path: string): boolean {
  return MARKUP_EXT.some((e) => path.endsWith(e));
}

function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) if (content[i] === "\n") line++;
  return line;
}

/** Each class/className attribute occurrence: its value + start index. */
function classAttrs(content: string): Array<{ value: string; index: number }> {
  const out: Array<{ value: string; index: number }> = [];
  const re = /(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*[`"']([^`"']*)[`"']\s*\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    out.push({ value: m[1] ?? m[2] ?? m[3] ?? "", index: m.index });
  }
  return out;
}

/** no-raw-class across markup files. */
export function checkNoRawClass(files: SourceFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const f of files) {
    if (!isMarkup(f.path)) continue;
    for (const attr of classAttrs(f.content)) {
      const raws = new Set<string>();
      for (const m of attr.value.matchAll(TW_PALETTE)) raws.add(m[0]);
      for (const m of attr.value.matchAll(TW_ARBITRARY_COLOR)) raws.add(m[0]);
      for (const raw of raws) {
        findings.push({
          ruleId: "no-raw-class",
          severity: "error",
          file: f.path,
          line: lineOf(f.content, attr.index),
          snippet: raw,
          message: `Raw Tailwind utility '${raw}' in markup. Use a semantic preset utility (e.g. bg-bg-default, text-text-primary).`,
          suggestedFix: `Replace palette utility '${raw}' with the matching semantic utility from the dsmcp preset.`,
        });
      }
    }
  }
  return findings;
}

type ElementType = "button" | "input" | "link";
const ELEMENT_TYPE: Record<string, ElementType> = {
  button: "button",
  input: "input",
  textarea: "input",
  select: "input",
  a: "link",
};
const REQUIRED_VARIANTS: Record<ElementType, string[]> = {
  button: ["hover", "active", "focus-visible", "disabled"],
  input: ["hover", "focus-visible", "disabled"],
  link: ["hover", "active", "focus-visible"],
};

function variantsIn(classValue: string): Set<string> {
  const v = new Set<string>();
  if (/\bhover:/.test(classValue)) v.add("hover");
  if (/\bactive:/.test(classValue)) v.add("active");
  if (/\bfocus-visible:/.test(classValue) || /\bfocus:/.test(classValue)) v.add("focus-visible");
  if (/\bdisabled:/.test(classValue) || /\baria-disabled/.test(classValue)) v.add("disabled");
  return v;
}

/** interactive-completeness for Tailwind markup (variant-prefix coverage). */
export function checkTailwindInteractive(files: SourceFile[]): Finding[] {
  const findings: Finding[] = [];
  // <tag ...> capturing tag name + attributes up to the closing '>'.
  const tagRe = /<(button|a|input|select|textarea)\b([^>]*)>/gi;
  for (const f of files) {
    if (!isMarkup(f.path)) continue;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(f.content))) {
      const type = ELEMENT_TYPE[m[1].toLowerCase()];
      const attrs = m[2];
      // ignore via a comment immediately before the tag
      const before = f.content.slice(Math.max(0, m.index - 120), m.index);
      if (IGNORE_RE.test(before)) continue;
      const cls = classAttrs(`<x ${attrs}>`)[0]?.value ?? "";
      const present = variantsIn(cls);
      const missing = REQUIRED_VARIANTS[type].filter((s) => !present.has(s));
      if (missing.length) {
        findings.push({
          ruleId: "interactive-completeness-tailwind",
          severity: "error",
          file: f.path,
          line: lineOf(f.content, m.index),
          snippet: `<${m[1]}>`,
          message: `Interactive ${type} <${m[1]}> is missing state variant(s): ${missing
            .map((s) => `${s}:`)
            .join(" ")}. Add them (they cover every mode via the data-theme preset).`,
          suggestedFix: `Add ${missing.map((s) => `${s}:…`).join(" ")} classes, or /* dsmcp-ignore interactive-completeness: <reason> */.`,
        });
      }
    }
  }
  return findings;
}
