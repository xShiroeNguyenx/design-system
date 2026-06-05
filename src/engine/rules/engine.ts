/**
 * Rule engine runner (PLAN §5–§7). Orchestrates theme-kind + code-kind rules
 * into one `ComplianceReport`. Used by `validate_code`, `validate_project`,
 * `report` and the CLI. `validate` exits 0 (pass) / 1 (errors) — never 2.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { Stack, ThemeDefinition } from "../tokens/types.js";
import { validateTheme } from "../tokens/resolver.js";
import { loadDefaultTheme } from "../tokens/loader.js";
import { Finding, SourceFile, ComplianceReport, buildReport } from "./types.js";
import { RULE_DEFS } from "./defs.js";
import { checkContrast } from "./contrast.js";
import { checkRawColor, checkSingleModeStrategy } from "./code-rules.js";
import { checkInteractiveCompleteness } from "./interactive.js";
import { checkNoRawClass, checkTailwindInteractive } from "./tailwind-rules.js";
import { checkRawColorDart } from "./flutter-rules.js";

/** mode-completeness: lift resolver diagnostics into findings. */
export function checkModeCompleteness(theme: ThemeDefinition): Finding[] {
  return validateTheme(theme).map((d) => ({
    ruleId: "mode-completeness",
    severity: d.severity,
    message: d.message,
    tokenPath: d.path,
    mode: d.mode,
  }));
}

/** All theme-kind rules. */
export function runThemeRules(theme: ThemeDefinition): Finding[] {
  return [...checkModeCompleteness(theme), ...checkContrast(theme)];
}

/**
 * Code-rule detector registry, keyed by ruleId. The runner executes only the
 * detectors whose RuleDef `appliesTo` includes the stack — so css-vars rules
 * never run (and vacuously "pass") a Tailwind project, and vice-versa.
 */
const CODE_DETECTORS: Record<string, (files: SourceFile[]) => Finding[]> = {
  "no-raw-color": (files) => files.flatMap((f) => checkRawColor(f)),
  "single-mode-strategy": (files) => checkSingleModeStrategy(files),
  "interactive-completeness": (files) => checkInteractiveCompleteness(files),
  "no-raw-class": (files) => checkNoRawClass(files),
  "interactive-completeness-tailwind": (files) => checkTailwindInteractive(files),
  "no-raw-color-dart": (files) => checkRawColorDart(files),
};

/** All applicable code-kind rules for `stack` over a set of files. */
export function runCodeRules(files: SourceFile[], stack: Stack): Finding[] {
  const findings: Finding[] = [];
  for (const def of RULE_DEFS) {
    if (def.kind !== "code") continue;
    if (!def.appliesTo.includes(stack)) continue;
    const detector = CODE_DETECTORS[def.id];
    if (detector) findings.push(...detector(files));
  }
  return findings;
}

export interface ValidateCodeInput {
  stack: Stack;
  /** Inline source to scan. */
  files?: SourceFile[];
  /** Single inline snippet (treated as a .css file unless `path` given). */
  code?: string;
  path?: string;
}

/** validate_code: scan provided source (no theme rules). */
export function validateCode(input: ValidateCodeInput): ComplianceReport {
  const files: SourceFile[] = input.files ? [...input.files] : [];
  if (input.code !== undefined) {
    files.push({ path: input.path ?? "snippet.css", content: input.code });
  }
  return buildReport(runCodeRules(files, input.stack));
}

const SCAN_EXT = [".css", ".html", ".htm", ".jsx", ".tsx", ".vue", ".svelte", ".astro", ".dart"];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".husky", ".github", "build", ".dart_tool"]);

function collectFiles(dir: string, root: string, out: SourceFile[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) collectFiles(full, root, out);
    } else if (SCAN_EXT.some((e) => entry.endsWith(e))) {
      out.push({ path: relative(root, full).replace(/\\/g, "/"), content: readFileSync(full, "utf8") });
    }
  }
}

export interface ValidateProjectOptions {
  stack?: Stack;
  /** Theme whose token rules to check; defaults to the bundled default theme. */
  theme?: ThemeDefinition;
  /** Skip theme-kind rules (only scan files). */
  codeOnly?: boolean;
}

/** validate_project: scan a directory's files + the theme's token rules. */
export function validateProject(dir: string, opts: ValidateProjectOptions = {}): ComplianceReport {
  const files: SourceFile[] = [];
  collectFiles(dir, dir, files);
  const stack = opts.stack ?? "css-vars";
  const findings = runCodeRules(files, stack);
  if (!opts.codeOnly) {
    const theme = opts.theme ?? loadDefaultTheme();
    findings.push(...runThemeRules(theme));
  }
  return { ...buildReport(findings), scannedFiles: files.length };
}
