/**
 * Contract builder (PLAN §6, tool `get_contract`).
 *
 * The contract is the "constitution" handed to an AI before it writes code:
 * the approved tokens, the (eventual) rules, a stack-specific guide, and a
 * paste-able instruction block. Pure engine code — `mcp/server.ts` and
 * `cli.ts` are thin callers.
 *
 * Phase 0 scope: tokens + guide + instruction block are real; the rule set is
 * a stub ([] — rules arrive in Phase 3).
 */

import { Stack, ThemeDefinition, TokenNode, ModeName } from "../tokens/types.js";
import { createContext, flattenTokens } from "../tokens/resolver.js";
import { listComponentNames } from "../components/specs.js";
import { RULE_DEFS, PLANNED_RULES } from "../rules/defs.js";

export interface ContractTokenEntry {
  path: string;
  type?: string;
  /** True if the value differs per mode (a mode map). */
  modeVarying: boolean;
  description?: string;
}

export interface ContractRule {
  id: string;
  severity: "error" | "warning";
  message: string;
}

export interface Contract {
  themeName: string;
  stack: Stack;
  modes: ModeName[];
  defaultMode: ModeName;
  /** Approved tokens, grouped by top-level category. */
  tokensByCategory: Record<string, ContractTokenEntry[]>;
  /** Governed components available via `get_component_spec`. */
  components: string[];
  /** Governance rules (Phase 0: empty stub). */
  rules: ContractRule[];
  /** Stack-specific usage guide. */
  guide: string;
  /** Paste-able instruction block for the AI to obey. */
  instructions: string;
}

function isModeMapValue(node: TokenNode, modeNames: Set<ModeName>): boolean {
  const v = node.$value;
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length > 0 && keys.every((k) => modeNames.has(k));
}

const STACK_GUIDES: Record<Stack, string> = {
  "css-vars":
    "Use CSS custom properties exposed under `:root` and `[data-theme=\"<mode>\"]`. " +
    "Reference tokens via `var(--color-bg-default)` etc. — never hardcode hex/rgb/hsl. " +
    "Switch modes by setting `data-theme` on `<html>`; do not mix `.dark` class and `data-theme`.",
  tailwind:
    "Use the generated Tailwind preset; reference semantic utilities (e.g. `bg-bg-default`, " +
    "`text-text-primary`) — never raw palette utilities like `bg-blue-500`. Drive modes with " +
    "`data-theme` variants, not ad-hoc `dark:` plus custom classes mixed together.",
  vanilla:
    "Use the generated `:root` + `[data-theme]` CSS variables and the provided class names. " +
    "Reference `var(--...)` tokens; never hardcode colors. One mode strategy: `data-theme`.",
  flutter:
    "Use the generated `ThemeData`/`ColorScheme` per mode and `Theme.of(context)` lookups. " +
    "Never use `Color(0xFF...)` literals for themed surfaces; map modes through `ThemeMode`.",
};

/** Build the governance contract for a stack. */
export function buildContract(theme: ThemeDefinition, stack: Stack): Contract {
  const ctx = createContext(theme);
  const flat = flattenTokens(theme.tokens);
  const modes = theme.modes.map((m) => m.name);

  const tokensByCategory: Record<string, ContractTokenEntry[]> = {};
  for (const [path, node] of flat) {
    const category = path.split(".")[0];
    (tokensByCategory[category] ??= []).push({
      path,
      type: node.$type,
      modeVarying: isModeMapValue(node, ctx.modeNames),
      description: node.$description,
    });
  }

  return {
    themeName: theme.name,
    stack,
    modes,
    defaultMode: theme.defaultMode,
    tokensByCategory,
    components: listComponentNames(),
    rules: [...RULE_DEFS, ...PLANNED_RULES].map((r) => ({
      id: r.id,
      severity: r.severity,
      message: r.summary,
    })),
    guide: STACK_GUIDES[stack],
    instructions: buildInstructionBlock(theme, stack),
  };
}

/** The paste-able "you MUST" block (PLAN §6 tool 1, §8 adoption). */
export function buildInstructionBlock(theme: ThemeDefinition, stack: Stack): string {
  const modes = theme.modes.map((m) => m.name).join(", ");
  return [
    `# Theme Governance Contract — ${theme.name} (${stack})`,
    "",
    "You MUST follow these rules when generating UI code for this project:",
    "",
    `1. Use ONLY the approved design tokens below. Declared modes: ${modes}. Default mode: ${theme.defaultMode}.`,
    "2. NEVER hardcode colors (hex/rgb/hsl), nor raw spacing/radius/shadow literals when a token exists.",
    "3. Every interactive element (button, link, input, toggle…) MUST define hover / active / focus-visible / disabled states — in EVERY declared mode.",
    "4. Every semantic token MUST resolve in EVERY declared mode; do not author a value for only one mode.",
    "5. Use a SINGLE mode strategy: `data-theme=\"<mode>\"`. Do not mix multiple theming mechanisms.",
    `6. Follow the stack guide: ${STACK_GUIDES[stack]}`,
    "7. Before finishing, run the validator (`dsmcp validate`) and fix every `error` finding.",
    "",
    "Call `get_component_spec` for any component you build to copy the governed blueprint instead of inventing styles.",
  ].join("\n");
}
