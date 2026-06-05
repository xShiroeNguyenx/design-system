/**
 * Rule engine types (PLAN §5). A rule declares its `kind`:
 *  - "theme": operates on resolved token values per mode (contrast, completeness),
 *  - "code":  scans authored files (raw-value, single-mode-strategy, flagship).
 * The runner feeds each rule the right input; all produce a common `Finding`.
 */

import { Stack } from "../tokens/types.js";

export type Severity = "error" | "warning";
export type RuleKind = "theme" | "code";

/** Declarative metadata for a rule (shown in `get_contract`). */
export interface RuleDef {
  id: string;
  kind: RuleKind;
  severity: Severity;
  /** One-line summary of what the rule enforces. */
  summary: string;
  /** Stacks the rule applies to (code rules); theme rules are stack-agnostic. */
  appliesTo: Stack[];
}

/** A single violation. */
export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  snippet?: string;
  /** Token path involved (theme rules). */
  tokenPath?: string;
  /** Mode involved (theme rules). */
  mode?: string;
  /** Human-readable fix hint (deterministic where possible). */
  suggestedFix?: string;
}

/** A file to scan (code rules). */
export interface SourceFile {
  /** Path/identifier for reporting. */
  path: string;
  content: string;
}

export interface ComplianceReport {
  findings: Finding[];
  errors: number;
  warnings: number;
  /** 0–100, deterministic: 100 − 10·errors − 3·warnings (floored at 0). */
  score: number;
  /** True when there are no `error`-severity findings. */
  pass: boolean;
  /** Number of files scanned by code rules (0 means nothing was checked!). */
  scannedFiles?: number;
}

/** Build a report (deterministic score) from findings. */
export function buildReport(findings: Finding[]): ComplianceReport {
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const score = Math.max(0, 100 - 10 * errors - 3 * warnings);
  return { findings, errors, warnings, score, pass: errors === 0 };
}
