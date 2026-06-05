#!/usr/bin/env node
/**
 * dsmcp CLI (PLAN §7) — the enforcement façade. Same engine as the MCP server.
 *
 * Phase 0: `contract` works end-to-end; `validate`/`scaffold`/`import`/`report`
 * are declared with clear "arrives in Phase N" messages and correct exit codes.
 */

import {
  buildContract,
  loadDefaultTheme,
  validateTheme,
  listTokens,
  resolveTokenSafe,
  getComponentSpec,
  listComponentNames,
  scaffoldTheme,
  generateDemo,
  writeFiles,
  validateProject,
  importTheme,
  Stack,
} from "./engine/index.js";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve as resolvePath } from "node:path";

const STACKS: Stack[] = ["css-vars", "tailwind", "vanilla", "flutter"];

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(args: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

function asStack(v: unknown): Stack {
  if (typeof v === "string" && (STACKS as string[]).includes(v)) return v as Stack;
  return "css-vars";
}

function printHelp(): void {
  process.stdout.write(
    [
      "dsmcp — Theme Governance CLI",
      "",
      "Usage: dsmcp <command> [options]",
      "",
      "Commands:",
      "  contract   Print the governance contract       [--stack css-vars|tailwind|vanilla|flutter] [--json]",
      "  list-tokens List approved tokens                [--category color] [--json]",
      "  resolve    Resolve a token in a mode            <token> [--mode light|dark]",
      "  component  Print a governed component blueprint <name> [--stack css-vars] [--json]",
      "  scaffold   Generate theme + adoption artifacts  --out <dir> [--stack <s>] [--modes light,dark]",
      "  demo       Generate demo/showcase page          --out <dir> [--stack <s>] [--modes ...]",
      "  validate   Validate a dir against the contract  [path] [--code-only] [--json]   (exit 1 on errors)",
      "  report     Compliance report + score            [path] [--json]                 (always exit 0)",
      "  import     Import a theme -> DTCG + gap report   --from css|tailwind --file <path> [--json]",
      "  doctor     Self-check the bundled default theme",
      "  help       Show this help",
      "",
    ].join("\n")
  );
}

function cmdContract(flags: Record<string, string | boolean>): number {
  const theme = loadDefaultTheme();
  const contract = buildContract(theme, asStack(flags.stack));
  if (flags.json) {
    process.stdout.write(JSON.stringify(contract, null, 2) + "\n");
  } else {
    process.stdout.write(contract.instructions + "\n");
  }
  return 0;
}

function cmdListTokens(flags: Record<string, string | boolean>): number {
  const theme = loadDefaultTheme();
  const category = typeof flags.category === "string" ? flags.category : undefined;
  const tokens = listTokens(theme, category);
  if (flags.json) {
    process.stdout.write(JSON.stringify(tokens, null, 2) + "\n");
  } else {
    for (const t of tokens) {
      const tag = t.modeVarying ? " [mode-varying]" : "";
      process.stdout.write(`${t.path} (${t.type ?? "?"})${tag}\n`);
    }
    process.stdout.write(`\n${tokens.length} token(s)\n`);
  }
  return 0;
}

function cmdResolve(positionals: string[], flags: Record<string, string | boolean>): number {
  const name = positionals[0];
  if (!name) {
    process.stderr.write("resolve: missing token path. Usage: dsmcp resolve <token> [--mode <mode>]\n");
    return 1;
  }
  const mode = typeof flags.mode === "string" ? flags.mode : "light";
  const theme = loadDefaultTheme();
  const result = resolveTokenSafe(theme, name, mode);
  if (flags.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return result.ok ? 0 : 1;
  }
  if (result.ok) {
    process.stdout.write(`${name} @ ${mode} = ${JSON.stringify(result.value)}\n`);
    return 0;
  }
  process.stderr.write(`✗ ${result.error}\n`);
  return 1;
}

function cmdComponent(positionals: string[], flags: Record<string, string | boolean>): number {
  const name = positionals[0];
  if (!name) {
    process.stderr.write(
      `component: missing name. Available: ${listComponentNames().join(", ")}\n`
    );
    return 1;
  }
  const result = getComponentSpec(name, asStack(flags.stack));
  if (!result.ok) {
    process.stderr.write(`✗ ${result.error}. Available: ${result.available.join(", ")}\n`);
    return 1;
  }
  if (flags.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return 0;
  }
  const { spec } = result;
  process.stdout.write(`# ${spec.name} — ${spec.description}\n`);
  process.stdout.write(`interactive: ${spec.interactive} | variants: ${spec.variants.join(", ")}\n`);
  if (spec.states.length) process.stdout.write(`states: ${spec.states.join(", ")}\n`);
  const code = spec.code[asStack(flags.stack)];
  process.stdout.write("\n" + (code ?? `(no code sample for this stack yet — Phase 4)`) + "\n");
  return 0;
}

function parseModes(flags: Record<string, string | boolean>): string[] | undefined {
  if (typeof flags.modes !== "string") return undefined;
  return flags.modes.split(",").map((m) => m.trim()).filter(Boolean);
}

function cmdScaffold(flags: Record<string, string | boolean>): number {
  const out = typeof flags.out === "string" ? flags.out : undefined;
  if (!out) {
    process.stderr.write("scaffold: --out <dir> is required.\n");
    return 1;
  }
  const theme = loadDefaultTheme();
  let result;
  try {
    result = scaffoldTheme(theme, { stack: asStack(flags.stack), modes: parseModes(flags) });
  } catch (err) {
    process.stderr.write(`✗ ${(err as Error).message}\n`);
    return 1;
  }
  const w = writeFiles(out, result.files);
  process.stdout.write(
    `✓ scaffolded ${result.stack} (${result.switcherKind} switcher, modes: ${result.modes.join(", ")}) -> ${out}\n`
  );
  process.stdout.write(`  written: ${w.written.length}, skipped(existing): ${w.skipped.join(", ") || "none"}\n`);
  return 0;
}

function cmdDemo(flags: Record<string, string | boolean>): number {
  const out = typeof flags.out === "string" ? flags.out : undefined;
  if (!out) {
    process.stderr.write("demo: --out <dir> is required.\n");
    return 1;
  }
  const theme = loadDefaultTheme();
  let result;
  try {
    result = generateDemo(theme, { stack: "css-vars", modes: parseModes(flags) });
  } catch (err) {
    process.stderr.write(`✗ ${(err as Error).message}\n`);
    return 1;
  }
  const w = writeFiles(out, result.files);
  process.stdout.write(`✓ demo generated (modes: ${result.modes.join(", ")}) -> ${out} [${w.written.length} files]\n`);
  return 0;
}

function printReport(report: ReturnType<typeof validateProject>): void {
  for (const f of report.findings) {
    const loc = f.file ? `${f.file}${f.line ? ":" + f.line : ""}` : f.tokenPath ?? "";
    const mode = f.mode ? ` (${f.mode})` : "";
    process.stdout.write(`  [${f.severity}] ${f.ruleId} ${loc}${mode}\n      ${f.message}\n`);
    if (f.suggestedFix) process.stdout.write(`      fix: ${f.suggestedFix}\n`);
  }
  process.stdout.write(
    `\nscore ${report.score}/100 — ${report.errors} error(s), ${report.warnings} warning(s) — ${report.pass ? "PASS" : "FAIL"}\n`
  );
}

function cmdValidate(positionals: string[], flags: Record<string, string | boolean>): number {
  const dir = positionals[0] ?? ".";
  const report = validateProject(dir, { codeOnly: flags["code-only"] === true });
  if (flags.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(`dsmcp validate: ${dir}\n`);
    printReport(report);
  }
  return report.pass ? 0 : 1; // 0/1 only — never 2 (generated hooks rely on this)
}

function cmdReport(positionals: string[], flags: Record<string, string | boolean>): number {
  const dir = positionals[0] ?? ".";
  const report = validateProject(dir);
  if (flags.json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else { process.stdout.write(`dsmcp report: ${dir}\n`); printReport(report); }
  return 0; // report is an artifact — never fails the process
}

function cmdImport(flags: Record<string, string | boolean>): number {
  const from = typeof flags.from === "string" ? flags.from : "";
  const file = typeof flags.file === "string" ? flags.file : "";
  if ((from !== "css" && from !== "tailwind") || !file) {
    process.stderr.write("import: usage: dsmcp import --from css|tailwind --file <path>\n");
    return 1;
  }
  let result;
  try {
    if (from === "css") {
      result = importTheme({ format: "css", source: readFileSync(file, "utf8"), name: file });
    } else {
      const abs = resolvePath(process.cwd(), file);
      const config = file.endsWith(".json")
        ? JSON.parse(readFileSync(abs, "utf8"))
        : createRequire(import.meta.url)(abs);
      result = importTheme({ format: "tailwind", config, name: file });
    }
  } catch (err) {
    process.stderr.write(`✗ import failed: ${(err as Error).message}\n`);
    return 1;
  }
  if (flags.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return 0;
  }
  process.stdout.write(`imported '${result.theme.name}' — modes: ${result.theme.modes.map((m) => m.name).join(", ")}\n`);
  process.stdout.write(`compliance score ${result.report.score}/100\n\nGaps:\n`);
  for (const g of result.gaps) process.stdout.write(`  - ${g}\n`);
  return 0;
}

function cmdDoctor(): number {
  const theme = loadDefaultTheme();
  const diags = validateTheme(theme);
  if (diags.length === 0) {
    process.stdout.write(
      `✓ default theme '${theme.name}' OK — ${theme.modes.length} modes, all tokens resolve.\n`
    );
    return 0;
  }
  process.stderr.write(`✗ default theme has ${diags.length} issue(s):\n`);
  for (const d of diags) {
    process.stderr.write(`  [${d.severity}] ${d.code} ${d.path ?? ""} (${d.mode ?? "-"}): ${d.message}\n`);
  }
  return 1;
}

function main(): void {
  const [, , cmd, ...rest] = process.argv;
  const { positionals, flags } = parseArgs(rest);

  let code = 0;
  switch (cmd) {
    case "contract":
      code = cmdContract(flags);
      break;
    case "list-tokens":
      code = cmdListTokens(flags);
      break;
    case "resolve":
      code = cmdResolve(positionals, flags);
      break;
    case "component":
      code = cmdComponent(positionals, flags);
      break;
    case "scaffold":
      code = cmdScaffold(flags);
      break;
    case "demo":
      code = cmdDemo(flags);
      break;
    case "doctor":
      code = cmdDoctor();
      break;
    case "validate":
      code = cmdValidate(positionals, flags);
      break;
    case "report":
      code = cmdReport(positionals, flags);
      break;
    case "import":
      code = cmdImport(flags);
      break;
    case "help":
    case undefined:
      printHelp();
      break;
    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n`);
      printHelp();
      code = 1;
  }
  process.exit(code);
}

main();
