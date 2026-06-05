#!/usr/bin/env node
/**
 * MCP stdio server (PLAN §2, §6) — thin façade over the engine.
 *
 * This is the "suggestion" surface: an AI calls `get_contract` while
 * generating code. It MUST stay thin — all logic lives in `engine/`.
 *
 * Phase 0: only `get_contract` is wired. More tools land in later phases.
 */

import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  buildContract,
  loadDefaultTheme,
  listTokens,
  resolveTokenSafe,
  getComponentSpec,
  listComponentNames,
  scaffoldTheme,
  generateDemo,
  writeFiles,
  validateCode,
  validateProject,
  suggestFix,
  importTheme,
  registerTheme,
  Stack,
  Finding,
  ThemeDefinition,
} from "../engine/index.js";

const STACKS = ["css-vars", "tailwind", "vanilla", "flutter"] as const;

function jsonText(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "dsmcp",
    version: "0.0.0",
  });

  server.registerTool(
    "get_contract",
    {
      title: "Get theme governance contract",
      description:
        "Return the design-system contract for a stack: approved tokens, rules, " +
        "a usage guide, and a paste-able instruction block. Call this FIRST before " +
        "generating any UI code.",
      inputSchema: {
        stack: z
          .enum(STACKS)
          .default("css-vars")
          .describe("Target stack for the contract."),
      },
    },
    async ({ stack }) => {
      const theme = loadDefaultTheme();
      const contract = buildContract(theme, stack as Stack);
      return {
        content: [
          { type: "text", text: contract.instructions },
          { type: "text", text: JSON.stringify(contract, null, 2) },
        ],
      };
    }
  );

  server.registerTool(
    "list_tokens",
    {
      title: "List approved tokens",
      description:
        "List approved design tokens (optionally one category), with type, " +
        "mode-variance flag, and the resolved value for every declared mode.",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe("Top-level category filter, e.g. 'color', 'space', 'button'."),
      },
    },
    async ({ category }) => {
      const theme = loadDefaultTheme();
      return jsonText(listTokens(theme, category));
    }
  );

  server.registerTool(
    "resolve_token",
    {
      title: "Resolve a token in a mode",
      description:
        "Resolve a single token path to its final literal value in a given mode " +
        "(any declared mode). Returns an error result if the token or mode is invalid.",
      inputSchema: {
        name: z.string().describe("Token path, e.g. 'color.bg.default'."),
        mode: z.string().default("light").describe("Declared mode name."),
      },
    },
    async ({ name, mode }) => {
      const theme = loadDefaultTheme();
      return jsonText(resolveTokenSafe(theme, name, mode));
    }
  );

  server.registerTool(
    "get_component_spec",
    {
      title: "Get governed component blueprint",
      description:
        "Return the governed blueprint for a component (token bindings, required " +
        "state matrix, and a copy-ready code sample for the stack). Copy this " +
        `instead of inventing styles. Available: ${listComponentNames().join(", ")}.`,
      inputSchema: {
        name: z.string().describe("Component name, e.g. 'button'."),
        stack: z.enum(STACKS).default("css-vars").describe("Target stack."),
      },
    },
    async ({ name, stack }) => {
      return jsonText(getComponentSpec(name, stack as Stack));
    }
  );

  server.registerTool(
    "scaffold_theme",
    {
      title: "Scaffold theme + adoption artifacts",
      description:
        "Generate the theme foundation (tokens.css, components.css, N-mode " +
        "switcher) plus adoption artifacts (CLAUDE.md, .cursorrules, config, " +
        "pre-commit/CI/Stop-hook wiring) for a stack. Writes to outDir if given, " +
        "otherwise returns the file contents. css-vars only for now (Phase 4: more).",
      inputSchema: {
        stack: z.enum(STACKS).default("css-vars").describe("Target stack."),
        modes: z
          .array(z.string())
          .optional()
          .describe("Modes to enable (subset of declared). Defaults to all."),
        outDir: z.string().optional().describe("Directory to write files into."),
      },
    },
    async ({ stack, modes, outDir }) => {
      const theme = loadDefaultTheme();
      const result = scaffoldTheme(theme, { stack: stack as Stack, modes });
      if (outDir) {
        const w = writeFiles(outDir, result.files);
        return jsonText({ ...result, files: undefined, outDir, ...w });
      }
      return jsonText(result);
    }
  );

  server.registerTool(
    "generate_demo",
    {
      title: "Generate demo / showcase page",
      description:
        "Generate a self-contained showcase rendering every token + governed " +
        "component across ALL enabled modes (live switcher + side-by-side), with " +
        "zero hardcoded values (golden fixture). Writes to outDir if given.",
      inputSchema: {
        stack: z.enum(STACKS).default("css-vars").describe("Target stack."),
        modes: z.array(z.string()).optional().describe("Modes to render. Defaults to all."),
        outDir: z.string().optional().describe("Directory to write files into."),
      },
    },
    async ({ stack, modes, outDir }) => {
      const theme = loadDefaultTheme();
      const result = generateDemo(theme, { stack: stack as "css-vars", modes });
      if (outDir) {
        const w = writeFiles(outDir, result.files);
        return jsonText({ ...result, files: undefined, outDir, ...w });
      }
      return jsonText(result);
    }
  );

  server.registerTool(
    "validate_code",
    {
      title: "Validate code against the contract",
      description:
        "Scan a code snippet (or files) for governance violations: raw colors, " +
        "mixed mode strategy. Returns structured findings + a compliance score.",
      inputSchema: {
        stack: z.enum(STACKS).default("css-vars").describe("Target stack."),
        code: z.string().optional().describe("Inline source to scan."),
        path: z.string().optional().describe("Filename hint for `code` (e.g. 'app.css')."),
        files: z
          .array(z.object({ path: z.string(), content: z.string() }))
          .optional()
          .describe("Multiple in-memory files to scan."),
      },
    },
    async ({ stack, code, path, files }) => {
      return jsonText(validateCode({ stack: stack as Stack, code, path, files }));
    }
  );

  server.registerTool(
    "validate_project",
    {
      title: "Validate a project directory",
      description:
        "Scan a directory's CSS/HTML for violations AND check the theme's token " +
        "rules (mode-completeness, WCAG AA contrast in every mode). Returns a " +
        "compliance report + score.",
      inputSchema: {
        dir: z.string().describe("Project directory to validate."),
        codeOnly: z.boolean().default(false).describe("Skip theme-kind (token) rules."),
      },
    },
    async ({ dir, codeOnly }) => {
      return jsonText(validateProject(dir, { codeOnly }));
    }
  );

  server.registerTool(
    "suggest_fix",
    {
      title: "Suggest a fix for a finding",
      description:
        "Given a finding, return a fix. Deterministic for raw colors (maps to a " +
        "var(--token)); a description for contrast/completeness (no mechanical fix).",
      inputSchema: {
        finding: z
          .object({
            ruleId: z.string(),
            severity: z.enum(["error", "warning"]).optional(),
            message: z.string(),
            suggestedFix: z.string().optional(),
          })
          .passthrough()
          .describe("A finding object from validate_code/validate_project."),
      },
    },
    async ({ finding }) => {
      const theme = loadDefaultTheme();
      return jsonText(suggestFix(finding as unknown as Finding, theme));
    }
  );

  server.registerTool(
    "import_theme",
    {
      title: "Import a theme from CSS or tailwind.config",
      description:
        "Normalize an external source to DTCG and REPORT gaps (missing modes, " +
        "WCAG AA contrast). Accepts CSS (`:root`/`[data-theme]` vars) or a parsed " +
        "tailwind.config object. Does not fail on gaps — it reports them.",
      inputSchema: {
        format: z.enum(["css", "tailwind"]).describe("Source format."),
        source: z.string().optional().describe("CSS text (format=css)."),
        config: z.record(z.string(), z.unknown()).optional().describe("Parsed tailwind.config (format=tailwind)."),
        name: z.string().optional().describe("Name for the imported theme."),
      },
    },
    async ({ format, source, config, name }) => {
      if (format === "css") {
        return jsonText(importTheme({ format: "css", source: source ?? "", name }));
      }
      return jsonText(importTheme({ format: "tailwind", config: config ?? {}, name }));
    }
  );

  server.registerTool(
    "register_theme",
    {
      title: "Register & validate a DTCG theme",
      description:
        "Validate a caller-provided DTCG theme definition against the governance " +
        "theme rules (mode-completeness, contrast). Returns acceptance + gaps.",
      inputSchema: {
        definition: z
          .object({
            name: z.string(),
            modes: z.array(z.object({ name: z.string() }).passthrough()),
            defaultMode: z.string(),
            tokens: z.record(z.string(), z.unknown()),
          })
          .passthrough()
          .describe("A DTCG ThemeDefinition."),
      },
    },
    async ({ definition }) => {
      return jsonText(registerTheme(definition as unknown as ThemeDefinition));
    }
  );

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio transport keeps the process alive; log to stderr only (stdout is the channel).
  process.stderr.write("dsmcp MCP server running on stdio\n");
}

// Run only when invoked directly (works cross-platform incl. Windows paths).
const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    process.stderr.write(`dsmcp server fatal: ${(err as Error).stack ?? err}\n`);
    process.exit(1);
  });
}
