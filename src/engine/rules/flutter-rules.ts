/**
 * Flutter code-kind rule (PLAN §5, stack flutter). A different engine: no CSS,
 * no postcss — scan Dart source text for hardcoded colors.
 *
 * Dart has NO syntactic definition-vs-usage discriminator (unlike CSS's `--x:`),
 * so the generated theme source carries a declared marker
 * `// dsmcp:generated` and `Color(0x..)` literals are allowed in marked files.
 * `Colors.<name>` (the Material palette) is ALWAYS usage — you cannot define with
 * it — so it is flagged everywhere, marker or not (the Dart analog of bg-blue-500).
 *
 * Known v1 limitation: theme defs + widgets in the same marked file lose widget
 * checking — recommend separate files. Not solved in v1.
 *
 * NOTE: generated Dart is structurally emitted/validated here but NOT
 * compile-verified (no Dart toolchain in this environment).
 */

import { Finding, SourceFile } from "./types.js";

// Anchored to a `//` comment line so prose mentioning the marker doesn't trip it.
const GENERATED_MARKER = /^\s*\/\/\s*dsmcp:generated\b/m;
const IGNORE_RE = /dsmcp-ignore\s+no-raw-color/;
const COLOR_HEX_RE = /\bColor\(\s*0x[0-9a-fA-F]{6,8}\s*\)/g;
const COLORS_PALETTE_RE = /\bColors\.[a-zA-Z][A-Za-z0-9]*(?:\.shade\d+)?/g;

function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) if (content[i] === "\n") line++;
  return line;
}

/** Is this line (or the line above it) marked dsmcp-ignore no-raw-color? */
function lineIgnored(content: string, index: number): boolean {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const lineEnd = content.indexOf("\n", index);
  const thisLine = content.slice(lineStart, lineEnd < 0 ? content.length : lineEnd);
  if (IGNORE_RE.test(thisLine)) return true;
  const prevStart = content.lastIndexOf("\n", lineStart - 2) + 1;
  return IGNORE_RE.test(content.slice(prevStart, lineStart));
}

/** no-raw-color-dart across .dart files. */
export function checkRawColorDart(files: SourceFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const f of files) {
    if (!f.path.endsWith(".dart")) continue;
    const isGenerated = GENERATED_MARKER.test(f.content);

    // Color(0x..) — allowed in generated/marked files (definitions).
    if (!isGenerated) {
      let m: RegExpExecArray | null;
      while ((m = COLOR_HEX_RE.exec(f.content))) {
        if (lineIgnored(f.content, m.index)) continue;
        findings.push({
          ruleId: "no-raw-color-dart",
          severity: "error",
          file: f.path,
          line: lineOf(f.content, m.index),
          snippet: m[0],
          message: `Hardcoded color '${m[0]}'. Use Theme.of(context).colorScheme.* (the themed token).`,
          suggestedFix: `Replace '${m[0]}' with a ColorScheme role, or mark the file '// dsmcp:generated' if it is a theme source.`,
        });
      }
    }

    // Colors.<name> — always usage, flagged regardless of marker.
    let cm: RegExpExecArray | null;
    while ((cm = COLORS_PALETTE_RE.exec(f.content))) {
      if (lineIgnored(f.content, cm.index)) continue;
      findings.push({
        ruleId: "no-raw-color-dart",
        severity: "error",
        file: f.path,
        line: lineOf(f.content, cm.index),
        snippet: cm[0],
        message: `Material palette color '${cm[0]}'. Use Theme.of(context).colorScheme.* instead.`,
        suggestedFix: `Replace '${cm[0]}' with the matching ColorScheme role.`,
      });
    }
  }
  return findings;
}
