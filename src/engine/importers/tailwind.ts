/**
 * tailwind.config importer (PLAN §9). Pulls the config's color palette into
 * DTCG primitive color tokens. Engine stays pure: the caller (CLI/MCP) loads the
 * config file (require/JSON) and passes the plain object here.
 *
 * A tailwind.config typically carries ONE palette (no per-mode values), so the
 * imported theme is single-mode by design — the missing dark mode is exactly the
 * gap `import_theme` then reports (it does not fail).
 */

import { ThemeDefinition, TokenTree } from "../tokens/types.js";

type ColorVal = string | { [k: string]: ColorVal };

interface TailwindConfigLike {
  theme?: {
    colors?: Record<string, ColorVal>;
    extend?: { colors?: Record<string, ColorVal> };
  };
}

function setDeep(tree: Record<string, unknown>, parts: string[], value: unknown): void {
  let cur = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function walkColors(colors: Record<string, ColorVal>, prefix: string[], out: Record<string, unknown>): void {
  for (const [key, val] of Object.entries(colors)) {
    if (key === "DEFAULT") {
      // Tailwind's DEFAULT collapses onto the parent name.
      if (typeof val === "string") setDeep(out, prefix, { $type: "color", $value: val });
      continue;
    }
    if (typeof val === "string") {
      setDeep(out, [...prefix, key], { $type: "color", $value: val });
    } else if (val && typeof val === "object") {
      walkColors(val, [...prefix, key], out);
    }
  }
}

export function importTailwindConfig(config: TailwindConfigLike, name = "imported-tailwind"): ThemeDefinition {
  const colors: Record<string, ColorVal> = {
    ...(config.theme?.colors ?? {}),
    ...(config.theme?.extend?.colors ?? {}),
  };
  const tokens: TokenTree = {};
  const colorTree: Record<string, unknown> = {};
  walkColors(colors, [], colorTree);
  (tokens as Record<string, unknown>).color = colorTree;

  return {
    name,
    description: "Imported from tailwind.config (palette only; single mode).",
    modes: [{ name: "light" }],
    defaultMode: "light",
    tokens,
  };
}
