/**
 * Token resolver (PLAN §4).
 *
 * Resolves `(tokenPath, mode) -> final literal value`, following:
 *  - mode maps (`{ light: ..., dark: ... }`) using the mode's `extends` chain,
 *  - DTCG references (`"{a.b.c}"`), recursively, with cycle detection.
 *
 * Also exposes `validateTheme` which surfaces the three structural defects
 * the plan calls out: a token missing a declared mode, a circular reference,
 * and a reference pointing at a token that does not exist.
 */

import {
  isTokenNode,
  ModeName,
  ModeDefinition,
  TokenNode,
  TokenTree,
  ThemeDefinition,
  ScalarValue,
  ModeMap,
} from "./types.js";

/** A single reference wrapped in braces: `{a.b.c}` (whole string). */
const WHOLE_REF_RE = /^\{([^}]+)\}$/;
/** Any embedded reference inside a string. */
const EMBEDDED_REF_RE = /\{([^}]+)\}/g;

export interface ResolverContext {
  /** Flat map: dotted token path -> token node. */
  tokens: Map<string, TokenNode>;
  /** Declared mode names. */
  modeNames: Set<ModeName>;
  /** mode -> ordered fallback chain [mode, parent, grandparent, ...]. */
  modeChains: Map<ModeName, ModeName[]>;
}

export interface ResolveResult {
  value: ScalarValue;
}

export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  /** Token path the diagnostic concerns. */
  path?: string;
  mode?: ModeName;
}

/** Flatten a DTCG token tree into `path -> TokenNode`. */
export function flattenTokens(tree: TokenTree, prefix = ""): Map<string, TokenNode> {
  const out = new Map<string, TokenNode>();
  for (const [key, node] of Object.entries(tree)) {
    if (key.startsWith("$")) continue; // group-level metadata ($type/$description)
    const path = prefix ? `${prefix}.${key}` : key;
    if (isTokenNode(node)) {
      out.set(path, node as TokenNode);
    } else if (typeof node === "object" && node !== null) {
      for (const [p, n] of flattenTokens(node as TokenTree, path)) out.set(p, n);
    }
  }
  return out;
}

/**
 * Build a mode's fallback chain via `extends`. Throws on a cyclic `extends`.
 */
export function buildModeChains(modes: ModeDefinition[]): Map<ModeName, ModeName[]> {
  const byName = new Map(modes.map((m) => [m.name, m]));
  const chains = new Map<ModeName, ModeName[]>();
  for (const mode of modes) {
    const chain: ModeName[] = [];
    const seen = new Set<ModeName>();
    let cur: ModeName | undefined = mode.name;
    while (cur) {
      if (seen.has(cur)) {
        throw new Error(`Cyclic mode 'extends' chain at mode '${mode.name}'`);
      }
      seen.add(cur);
      chain.push(cur);
      cur = byName.get(cur)?.extends;
    }
    chains.set(mode.name, chain);
  }
  return chains;
}

/** Create a reusable resolver context from a theme. */
export function createContext(theme: ThemeDefinition): ResolverContext {
  return {
    tokens: flattenTokens(theme.tokens),
    modeNames: new Set(theme.modes.map((m) => m.name)),
    modeChains: buildModeChains(theme.modes),
  };
}

/** Is `value` a per-mode map (plain object whose keys are all declared modes)? */
function isModeMap(value: unknown, modeNames: Set<ModeName>): value is ModeMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  return keys.every((k) => modeNames.has(k));
}

/** Pick a mode map's value for `mode`, walking the mode's fallback chain. */
function pickForMode(
  map: ModeMap,
  mode: ModeName,
  ctx: ResolverContext
): { found: true; value: ScalarValue } | { found: false } {
  const chain = ctx.modeChains.get(mode) ?? [mode];
  for (const m of chain) {
    if (Object.prototype.hasOwnProperty.call(map, m)) {
      return { found: true, value: map[m] };
    }
  }
  return { found: false };
}

/**
 * Resolve a token path for a mode into a final literal value.
 * Throws on dangling references, circular references, or a missing mode.
 */
export function resolveToken(path: string, mode: ModeName, ctx: ResolverContext): ScalarValue {
  return resolvePath(path, mode, ctx, new Set());
}

function resolvePath(
  path: string,
  mode: ModeName,
  ctx: ResolverContext,
  visiting: Set<string>
): ScalarValue {
  const key = `${path}@${mode}`;
  if (visiting.has(key)) {
    throw new Error(`Circular reference at '${path}' (mode '${mode}')`);
  }
  const node = ctx.tokens.get(path);
  if (!node) {
    throw new Error(`Dangling reference: token '${path}' does not exist`);
  }
  visiting.add(key);
  try {
    let raw: ScalarValue = node.$value as ScalarValue;
    if (isModeMap(node.$value, ctx.modeNames)) {
      const picked = pickForMode(node.$value as ModeMap, mode, ctx);
      if (!picked.found) {
        throw new Error(`Token '${path}' has no value for mode '${mode}'`);
      }
      raw = picked.value;
    }
    return deepResolve(raw, mode, ctx, visiting);
  } finally {
    visiting.delete(key);
  }
}

/** Resolve references appearing inside any value (string, object, array). */
function deepResolve(
  value: ScalarValue,
  mode: ModeName,
  ctx: ResolverContext,
  visiting: Set<string>
): ScalarValue {
  if (typeof value === "string") {
    const whole = value.match(WHOLE_REF_RE);
    if (whole) {
      return resolvePath(whole[1], mode, ctx, visiting);
    }
    if (EMBEDDED_REF_RE.test(value)) {
      return value.replace(EMBEDDED_REF_RE, (_m, ref) =>
        String(resolvePath(ref, mode, ctx, visiting))
      );
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => deepResolve(v as ScalarValue, mode, ctx, visiting)) as unknown as ScalarValue;
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = deepResolve(v as ScalarValue, mode, ctx, visiting);
    }
    return out;
  }
  return value;
}

/**
 * Structural validation of a theme (PLAN §4, §75):
 *  - every token resolves for every declared mode,
 *  - no dangling references, no circular references,
 *  - mode-map tokens cover every mode (via extends chains).
 */
export function validateTheme(theme: ThemeDefinition): Diagnostic[] {
  const diags: Diagnostic[] = [];

  // defaultMode must be declared
  if (!theme.modes.some((m) => m.name === theme.defaultMode)) {
    diags.push({
      code: "default-mode-undeclared",
      severity: "error",
      message: `defaultMode '${theme.defaultMode}' is not a declared mode`,
    });
  }

  let ctx: ResolverContext;
  try {
    ctx = createContext(theme);
  } catch (err) {
    diags.push({
      code: "mode-extends-cycle",
      severity: "error",
      message: (err as Error).message,
    });
    return diags;
  }

  for (const [path] of ctx.tokens) {
    for (const mode of ctx.modeNames) {
      try {
        resolveToken(path, mode, ctx);
      } catch (err) {
        const message = (err as Error).message;
        const code = message.includes("Circular")
          ? "circular-reference"
          : message.includes("Dangling")
          ? "dangling-reference"
          : message.includes("no value for mode")
          ? "missing-mode"
          : "resolve-error";
        diags.push({ code, severity: "error", message, path, mode });
      }
    }
  }

  return diags;
}
