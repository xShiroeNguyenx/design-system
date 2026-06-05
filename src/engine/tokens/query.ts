/**
 * Token lookup helpers (PLAN §6 tools `list_tokens`, `resolve_token`).
 * Pure engine; façades wrap these.
 */

import { ThemeDefinition, ModeName, ScalarValue } from "./types.js";
import { createContext, flattenTokens, resolveToken } from "./resolver.js";

export interface TokenListEntry {
  path: string;
  type?: string;
  /** True if the value differs per mode. */
  modeVarying: boolean;
  description?: string;
  /** Resolved value per declared mode. */
  resolved: Record<ModeName, ScalarValue | { error: string }>;
}

/** List tokens, optionally filtered by top-level category (e.g. "color"). */
export function listTokens(theme: ThemeDefinition, category?: string): TokenListEntry[] {
  const ctx = createContext(theme);
  const flat = flattenTokens(theme.tokens);
  const modes = theme.modes.map((m) => m.name);
  const out: TokenListEntry[] = [];

  for (const [path, node] of flat) {
    if (category && path.split(".")[0] !== category) continue;
    const v = node.$value;
    const modeVarying =
      typeof v === "object" &&
      v !== null &&
      !Array.isArray(v) &&
      Object.keys(v).length > 0 &&
      Object.keys(v).every((k) => ctx.modeNames.has(k));

    const resolved: Record<ModeName, ScalarValue | { error: string }> = {};
    for (const mode of modes) {
      try {
        resolved[mode] = resolveToken(path, mode, ctx);
      } catch (err) {
        resolved[mode] = { error: (err as Error).message };
      }
    }
    out.push({ path, type: node.$type, modeVarying, description: node.$description, resolved });
  }
  return out;
}

export type ResolveTokenResult =
  | { ok: true; path: string; mode: ModeName; value: ScalarValue }
  | { ok: false; path: string; mode: ModeName; error: string };

/** Resolve a single token for a mode (safe — never throws). */
export function resolveTokenSafe(
  theme: ThemeDefinition,
  path: string,
  mode: ModeName
): ResolveTokenResult {
  const declared = theme.modes.some((m) => m.name === mode);
  if (!declared) {
    return {
      ok: false,
      path,
      mode,
      error: `Mode '${mode}' is not declared. Declared: ${theme.modes.map((m) => m.name).join(", ")}`,
    };
  }
  const ctx = createContext(theme);
  try {
    return { ok: true, path, mode, value: resolveToken(path, mode, ctx) };
  } catch (err) {
    return { ok: false, path, mode, error: (err as Error).message };
  }
}
