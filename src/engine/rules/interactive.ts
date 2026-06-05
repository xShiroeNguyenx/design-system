/**
 * ⭐ Flagship rule: interactive-completeness (PLAN §5, §13 risk #1).
 *
 * Framing (the scope collapse): governed css-vars output references mode-scoped
 * vars, so `.btn:hover { background: var(--button-primary-hover) }` already
 * covers EVERY mode (the var swaps under `[data-theme]`). "States in every mode"
 * therefore reduces to two checks handled separately:
 *   1. the state SELECTORS exist  ← this rule, and
 *   2. their referenced VALUES are mode-complete  ← the mode-completeness rule.
 * So this is a CSS state-selector-COVERAGE check — no per-mode CSS analysis.
 *
 * False-positive control (the whole game):
 *  - Fire only on conservative, declared signals: real interactive elements
 *    (button/a/input/select/textarea) and known governed classes (.btn, .input).
 *  - Group base + variants into ONE component family (.btn covers .btn--primary),
 *    so split states across the family count together.
 *  - Required states are element-type-aware (text inputs have no :active; links
 *    accept [aria-disabled]).
 *  - Escape hatch: `/* dsmcp-ignore interactive-completeness: <reason> *​/`.
 *  - CSS + <style> only — never HTML/inline/DOM ("is this <a> interactive?" is
 *    the DOM problem we deliberately don't solve here).
 *
 * Known v1 limitation: a state scoped ONLY under `[data-theme="x"] .btn:hover`
 * defeats the mode-reduction; out of scope for v1.
 */

import postcss, { Rule, Comment } from "postcss";
import { Finding, SourceFile } from "./types.js";

type ElementType = "button" | "input" | "link";
type State = "hover" | "active" | "focus-visible" | "disabled";

/** Known governed component classes (BEM block -> type). */
const CLASS_SIGNALS: Record<string, { family: string; type: ElementType }> = {
  btn: { family: ".btn", type: "button" },
  input: { family: ".input", type: "input" },
};

/** Real interactive HTML elements. */
const ELEMENT_SIGNALS: Record<string, ElementType> = {
  button: "button",
  input: "input",
  textarea: "input",
  select: "input",
  a: "link",
};

const REQUIRED: Record<ElementType, State[]> = {
  button: ["hover", "active", "focus-visible", "disabled"],
  input: ["hover", "focus-visible", "disabled"],
  link: ["hover", "active", "focus-visible"],
};

const IGNORE_RE = /dsmcp-ignore\s+interactive-completeness/;

interface Family {
  key: string;
  type: ElementType;
  states: Set<State>;
  file: string;
  line: number;
  ignored: boolean;
}

/** Rightmost compound selector (the subject), combinators stripped. */
function rightmostCompound(selector: string): string {
  const parts = selector.trim().split(/\s*[>+~]\s*|\s+/);
  return parts[parts.length - 1] ?? selector;
}

/** Extract the states present in a compound (after removing :not(...)). */
function statesIn(compound: string): Set<State> {
  const t = compound.replace(/:not\([^)]*\)/g, "");
  const states = new Set<State>();
  if (/:hover/.test(t)) states.add("hover");
  if (/:active/.test(t)) states.add("active");
  if (/:focus-visible/.test(t) || /:focus(?!-)/.test(t)) states.add("focus-visible");
  if (/:disabled/.test(t) || /\[disabled\]/.test(t) || /\[aria-disabled/.test(t)) states.add("disabled");
  return states;
}

/** Identify the interactive family a compound targets, if any. */
function classify(compound: string): { key: string; type: ElementType } | undefined {
  const t = compound.replace(/:not\([^)]*\)/g, "");
  // Prefer a known governed class (BEM block).
  const classMatches = [...t.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]);
  for (const cls of classMatches) {
    const block = cls.split("--")[0];
    const sig = CLASS_SIGNALS[block];
    if (sig) return { key: sig.family, type: sig.type };
  }
  // Else a real interactive element at the start of the compound.
  const el = t.match(/^([a-zA-Z]+)/)?.[1]?.toLowerCase();
  if (el && ELEMENT_SIGNALS[el]) return { key: el, type: ELEMENT_SIGNALS[el] };
  return undefined;
}

function ingestRule(rule: Rule, file: string, families: Map<string, Family>): void {
  const prev = rule.prev();
  const ignoredHere = prev?.type === "comment" && IGNORE_RE.test((prev as Comment).text);

  for (const selector of rule.selectors ?? [rule.selector]) {
    const compound = rightmostCompound(selector);
    const sig = classify(compound);
    if (!sig) continue;
    let fam = families.get(sig.key);
    if (!fam) {
      fam = {
        key: sig.key,
        type: sig.type,
        states: new Set(),
        file,
        line: rule.source?.start?.line ?? 1,
        ignored: false,
      };
      families.set(sig.key, fam);
    }
    for (const s of statesIn(compound)) fam.states.add(s);
    if (ignoredHere) fam.ignored = true;
  }
}

function scanCss(css: string, file: string, families: Map<string, Family>): void {
  let root;
  try {
    root = postcss.parse(css);
  } catch {
    return;
  }
  root.walkRules((rule) => ingestRule(rule, file, families));
}

/**
 * interactive-completeness over a set of files (aggregated cross-file, so a base
 * class in one file and its variants in another still count together).
 */
export function checkInteractiveCompleteness(files: SourceFile[]): Finding[] {
  const families = new Map<string, Family>();
  for (const f of files) {
    if (f.path.endsWith(".css")) {
      scanCss(f.content, f.path, families);
    } else if (f.path.endsWith(".html") || f.path.endsWith(".htm")) {
      const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
      let m: RegExpExecArray | null;
      while ((m = styleRe.exec(f.content))) scanCss(m[1], f.path, families);
    }
  }

  const findings: Finding[] = [];
  for (const fam of families.values()) {
    if (fam.ignored) continue;
    const missing = REQUIRED[fam.type].filter((s) => !fam.states.has(s));
    if (missing.length) {
      findings.push({
        ruleId: "interactive-completeness",
        severity: "error",
        file: fam.file,
        line: fam.line,
        snippet: fam.key,
        message: `Interactive ${fam.type} '${fam.key}' is missing state(s): ${missing.join(", ")}. ` +
          `Define them (they cover every mode via mode-scoped vars).`,
        suggestedFix: `Add ${missing.map((s) => `${fam.key}:${s === "focus-visible" ? "focus-visible" : s}`).join(", ")} rules, or mark ` +
          `/* dsmcp-ignore interactive-completeness: <reason> */ if intentional.`,
      });
    }
  }
  return findings;
}
