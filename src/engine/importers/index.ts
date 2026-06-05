/**
 * Theme import/register facade (PLAN §6 tool 9, §9). Normalizes an external
 * source to DTCG, then runs the theme-kind rules to REPORT gaps (missing modes,
 * contrast) rather than throwing — that gap report is the feature.
 */

import { ThemeDefinition } from "../tokens/types.js";
import { ComplianceReport, buildReport } from "../rules/types.js";
import { runThemeRules } from "../rules/engine.js";
import { importCss } from "./css.js";
import { importTailwindConfig } from "./tailwind.js";

export { importCss } from "./css.js";
export { importTailwindConfig } from "./tailwind.js";

export type ImportSource =
  | { format: "css"; source: string; name?: string }
  | { format: "tailwind"; config: unknown; name?: string };

export interface ImportResult {
  theme: ThemeDefinition;
  report: ComplianceReport;
  /** Human-readable gap summary. */
  gaps: string[];
}

function summarizeGaps(theme: ThemeDefinition, report: ComplianceReport): string[] {
  const gaps: string[] = [];
  if (theme.modes.length < 2) {
    gaps.push(`Only ${theme.modes.length} mode (${theme.modes.map((m) => m.name).join(", ")}); no dark mode — most apps need light + dark.`);
  }
  const byRule = (id: string) => report.findings.filter((f) => f.ruleId === id).length;
  const mc = byRule("mode-completeness");
  const ct = byRule("contrast-aa");
  if (mc) gaps.push(`${mc} token(s) do not resolve in every mode.`);
  if (ct) gaps.push(`${ct} text↔bg pair(s) fail WCAG AA contrast.`);
  if (!gaps.length) gaps.push("No structural gaps detected.");
  return gaps;
}

/** Import + normalize + report gaps. Never throws on gaps. */
export function importTheme(input: ImportSource): ImportResult {
  const theme =
    input.format === "css"
      ? importCss(input.source, input.name).theme
      : importTailwindConfig(input.config as never, input.name);
  const report = buildReport(runThemeRules(theme));
  return { theme, report, gaps: summarizeGaps(theme, report) };
}

export interface RegisterResult {
  theme: ThemeDefinition;
  report: ComplianceReport;
  gaps: string[];
  /** True when the theme has no error-severity findings. */
  accepted: boolean;
}

/** Validate a caller-provided DTCG theme definition against the theme rules. */
export function registerTheme(theme: ThemeDefinition): RegisterResult {
  const report = buildReport(runThemeRules(theme));
  return { theme, report, gaps: summarizeGaps(theme, report), accepted: report.pass };
}
