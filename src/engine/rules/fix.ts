/**
 * suggest_fix (PLAN §6 tool 7). Honest per rule:
 *  - no-raw-color: deterministic — reverse-map the raw hex to a token and
 *    suggest `var(--token)` (preferring a semantic token over a primitive).
 *  - single-mode-strategy: the finding already carries a concrete replacement.
 *  - contrast-aa / mode-completeness: NO mechanical fix — return a description.
 */

import { ThemeDefinition } from "../tokens/types.js";
import { createContext, flattenTokens, resolveToken } from "../tokens/resolver.js";
import { cssVarName } from "../adapters/css-vars/naming.js";
import { Finding } from "./types.js";

const SEMANTIC_RE = /^color\.(bg|text|border|action)\b/;

/** value (normalized hex) -> token path, semantic preferred over primitive. */
function buildReverseColorMap(theme: ThemeDefinition): Map<string, string> {
  const ctx = createContext(theme);
  const map = new Map<string, string>();
  const defaultMode = theme.defaultMode;
  for (const [path] of flattenTokens(theme.tokens)) {
    if (!path.startsWith("color.")) continue;
    let value: string;
    try {
      value = String(resolveToken(path, defaultMode, ctx));
    } catch {
      continue;
    }
    if (!/^#[0-9a-fA-F]{3,8}$/.test(value)) continue;
    const key = value.toLowerCase();
    const existing = map.get(key);
    // prefer a semantic token; otherwise keep the first seen.
    if (!existing || (SEMANTIC_RE.test(path) && !SEMANTIC_RE.test(existing))) {
      map.set(key, path);
    }
  }
  return map;
}

function normalizeHex(hex: string): string {
  const s = hex.toLowerCase().replace(/^#/, "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return "#" + full;
}

export interface SuggestFixResult {
  ruleId: string;
  fixable: boolean;
  /** Suggested replacement snippet, when deterministic. */
  replacement?: string;
  description: string;
}

/** Return a fix suggestion for a finding. */
export function suggestFix(finding: Finding, theme: ThemeDefinition): SuggestFixResult {
  switch (finding.ruleId) {
    case "no-raw-color": {
      const hex = finding.message.match(/#[0-9a-fA-F]{3,8}\b/)?.[0];
      if (!hex) {
        return {
          ruleId: finding.ruleId,
          fixable: false,
          description: "Raw color uses rgb()/hsl(); replace with a var(--token).",
        };
      }
      const map = buildReverseColorMap(theme);
      const path = map.get(normalizeHex(hex));
      if (path) {
        const ref = `var(${cssVarName(path)})`;
        return {
          ruleId: finding.ruleId,
          fixable: true,
          replacement: ref,
          description: `Replace '${hex}' with ${ref} (token ${path}).`,
        };
      }
      return {
        ruleId: finding.ruleId,
        fixable: false,
        description: `No token matches '${hex}'. Add it to the theme or pick the nearest semantic token.`,
      };
    }
    case "single-mode-strategy":
      return {
        ruleId: finding.ruleId,
        fixable: true,
        replacement: finding.suggestedFix,
        description: finding.suggestedFix ?? "Use a single mode strategy (data-theme).",
      };
    case "contrast-aa":
      return {
        ruleId: finding.ruleId,
        fixable: false,
        description:
          finding.suggestedFix ??
          "No mechanical fix — adjust the fg/bg token values to meet WCAG AA, then re-validate.",
      };
    case "mode-completeness":
      return {
        ruleId: finding.ruleId,
        fixable: false,
        description: "Add the missing mode value / fix the reference, then re-validate.",
      };
    default:
      return { ruleId: finding.ruleId, fixable: false, description: "No suggestion available." };
  }
}
