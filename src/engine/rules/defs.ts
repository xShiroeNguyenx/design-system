/**
 * Rule catalog (PLAN §5). Metadata only — surfaced via `get_contract` so an AI
 * knows what it will be checked against. Detection lives in the sibling modules.
 *
 * Phase 3a ships the "easy" + completeness + contrast rules. The flagship
 * `interactive-completeness` rule (Phase 3b) is listed as `planned` and not yet
 * enforced.
 */

import { RuleDef } from "./types.js";

export const RULE_DEFS: RuleDef[] = [
  {
    id: "no-raw-color",
    kind: "code",
    severity: "error",
    summary:
      "No raw hex/rgb/hsl color in property VALUES; use var(--token). " +
      "Custom-property definitions (--x: #fff) are allowed.",
    appliesTo: ["css-vars", "vanilla"],
  },
  {
    id: "single-mode-strategy",
    kind: "code",
    severity: "warning",
    summary:
      "Use one mode strategy: data-theme=\"<mode>\". Don't mix the 2-mode .dark " +
      "class with [data-theme] selectors.",
    appliesTo: ["css-vars", "vanilla"],
  },
  {
    id: "mode-completeness",
    kind: "theme",
    severity: "error",
    summary: "Every token resolves in every declared mode (no missing/dangling/cyclic).",
    appliesTo: [],
  },
  {
    id: "contrast-aa",
    kind: "theme",
    severity: "error",
    summary: "Declared text↔bg token pairs meet WCAG AA (4.5:1) in every mode.",
    appliesTo: [],
  },
  {
    id: "interactive-completeness",
    kind: "code",
    severity: "error",
    summary:
      "Every interactive element (button/input/link) defines its required states " +
      "(hover/active/focus-visible/disabled, element-type-aware) — which cover " +
      "every mode via mode-scoped vars.",
    appliesTo: ["css-vars", "vanilla"],
  },
  {
    id: "no-raw-class",
    kind: "code",
    severity: "error",
    summary:
      "No raw Tailwind palette utilities (bg-blue-500, text-red-600…) in markup; " +
      "use the semantic preset utilities (bg-bg-default, text-text-primary…).",
    appliesTo: ["tailwind"],
  },
  {
    id: "interactive-completeness-tailwind",
    kind: "code",
    severity: "error",
    summary:
      "Every interactive element defines its required state VARIANTS " +
      "(hover:/active:/focus-visible:/disabled:, element-type-aware) in markup.",
    appliesTo: ["tailwind"],
  },
  {
    id: "no-raw-color-dart",
    kind: "code",
    severity: "error",
    summary:
      "No hardcoded Color(0x…) (outside a // dsmcp:generated theme source) or " +
      "Colors.<name> palette in Dart; use Theme.of(context).colorScheme.*.",
    appliesTo: ["flutter"],
  },
];

/** Rules declared but not yet enforced. */
export const PLANNED_RULES: RuleDef[] = [];
