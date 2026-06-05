/**
 * Code-kind rules (PLAN §5). Scan authored files for drift.
 *
 *  - no-raw-color: raw hex/rgb/hsl in property VALUES. The lynchpin is
 *    definition-vs-usage: a custom-property DEFINITION (`--x: #fff`) is allowed
 *    (that's how tokens are declared), a USAGE (`color: #fff`) is a violation.
 *    So the generated tokens.css passes automatically — no file-exclusion list.
 *  - single-mode-strategy: don't mix the 2-mode `.dark` class with `[data-theme]`.
 */

import postcss, { Declaration } from "postcss";
import { Finding, SourceFile } from "./types.js";

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const FUNC_COLOR_RE = /\b(rgba?|hsla?)\s*\(/gi;

/** Raw color tokens found in a CSS value. */
function rawColorsIn(value: string): string[] {
  const out: string[] = [];
  out.push(...(value.match(HEX_RE) ?? []));
  out.push(...(value.match(FUNC_COLOR_RE) ?? []).map((m) => m.replace(/\s*\($/, "()")));
  return out;
}

/** Run no-raw-color over a block of CSS; lines are offset by `baseLine`. */
function scanCss(css: string, file: string, baseLine: number): Finding[] {
  const findings: Finding[] = [];
  let root;
  try {
    root = postcss.parse(css);
  } catch {
    return findings; // unparseable fragment — skip
  }
  root.walkDecls((decl: Declaration) => {
    if (decl.prop.startsWith("--")) return; // DEFINITION — allowed
    const raws = rawColorsIn(decl.value);
    for (const raw of raws) {
      findings.push({
        ruleId: "no-raw-color",
        severity: "error",
        file,
        line: baseLine + (decl.source?.start?.line ?? 1),
        column: decl.source?.start?.column,
        snippet: `${decl.prop}: ${decl.value}`,
        message: `Raw color '${raw}' in '${decl.prop}'. Use var(--token) instead.`,
      });
    }
  });
  return findings;
}

function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) if (content[i] === "\n") line++;
  return line;
}

/** no-raw-color across a single file (.css, or .html with <style>/inline styles). */
export function checkRawColor(file: SourceFile): Finding[] {
  const { path, content } = file;
  if (path.endsWith(".css")) return scanCss(content, path, 0);

  if (path.endsWith(".html") || path.endsWith(".htm")) {
    const findings: Finding[] = [];
    // <style> blocks
    const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let m: RegExpExecArray | null;
    while ((m = styleRe.exec(content))) {
      const baseLine = lineOf(content, m.index) - 1;
      findings.push(...scanCss(m[1], path, baseLine));
    }
    // inline style="..." attributes
    const attrRe = /style\s*=\s*"([^"]*)"/gi;
    while ((m = attrRe.exec(content))) {
      const decls = m[1].split(";");
      for (const d of decls) {
        const idx = d.indexOf(":");
        if (idx < 0) continue;
        const prop = d.slice(0, idx).trim();
        const value = d.slice(idx + 1).trim();
        if (!prop || prop.startsWith("--")) continue;
        for (const raw of rawColorsIn(value)) {
          findings.push({
            ruleId: "no-raw-color",
            severity: "error",
            file: path,
            line: lineOf(content, m.index),
            snippet: `style="...${prop}: ${value}..."`,
            message: `Raw color '${raw}' in inline style '${prop}'. Use var(--token) instead.`,
          });
        }
      }
    }
    return findings;
  }
  return [];
}

/** single-mode-strategy: flag mixing `.dark` class with `[data-theme]` selectors. */
export function checkSingleModeStrategy(files: SourceFile[]): Finding[] {
  let usesDataTheme = false;
  let dataThemeFile: SourceFile | undefined;
  const darkClassHits: Array<{ file: string; line: number }> = [];

  for (const f of files) {
    if (/\[data-theme/.test(f.content)) {
      usesDataTheme = true;
      dataThemeFile ??= f;
    }
    // `.dark` used as a selector (start or descendant), not "data-theme".
    const re = /(^|[\s,>{])\.dark\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.content))) {
      darkClassHits.push({ file: f.path, line: lineOf(f.content, m.index) });
    }
  }

  if (usesDataTheme && darkClassHits.length) {
    return darkClassHits.map((hit) => ({
      ruleId: "single-mode-strategy",
      severity: "warning" as const,
      file: hit.file,
      line: hit.line,
      message:
        "Mixing mode strategies: `.dark` class found alongside `[data-theme]` selectors. " +
        "Pick one — use `data-theme=\"<mode>\"` consistently.",
      suggestedFix: `Replace '.dark' selector with '[data-theme="dark"]'.`,
    }));
  }
  return [];
}
