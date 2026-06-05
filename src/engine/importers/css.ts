/**
 * CSS importer (PLAN §9). The inverse of the css-vars emitter: read
 * `:root` / `[data-theme="<mode>"]` custom-property blocks and reconstruct a
 * DTCG theme. A var defined under multiple modes becomes a mode map; a var only
 * in `:root` becomes a mode-agnostic scalar.
 *
 * Reconstruction is intentionally lossy on grouping (`--a-b-c` -> `a.b.c`) — the
 * goal is to normalize + then REPORT gaps (missing modes, contrast), not a
 * byte-perfect round-trip.
 */

import postcss, { Declaration } from "postcss";
import { ModeDefinition, ThemeDefinition, TokenTree, ModeName } from "../tokens/types.js";

const DATA_THEME_RE = /^\[data-theme=["']?([^"'\]]+)["']?\]$/;

/** `--color-bg-default` -> `color.bg.default`. */
function varToPath(prop: string): string {
  return prop.replace(/^--/, "").split("-").join(".");
}

function setDeep(tree: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export interface CssImportResult {
  theme: ThemeDefinition;
  /** Modes discovered from [data-theme] selectors. */
  discoveredModes: ModeName[];
}

/** Parse a CSS string into a DTCG `ThemeDefinition`. */
export function importCss(css: string, name = "imported-css"): CssImportResult {
  const root = postcss.parse(css);
  // path -> mode -> value ; ":root" used as the implicit base bucket.
  const collected = new Map<string, Map<string, string>>();
  const modeSet = new Set<ModeName>();

  root.walkRules((rule) => {
    for (const selector of rule.selectors ?? [rule.selector]) {
      const sel = selector.trim();
      let bucket: string | undefined;
      if (sel === ":root") bucket = ":root";
      else {
        const m = sel.match(DATA_THEME_RE);
        if (m) {
          bucket = m[1];
          modeSet.add(m[1]);
        }
      }
      if (!bucket) continue;
      rule.walkDecls((decl: Declaration) => {
        if (!decl.prop.startsWith("--")) return;
        const path = varToPath(decl.prop);
        if (!collected.has(path)) collected.set(path, new Map());
        collected.get(path)!.set(bucket, decl.value.trim());
      });
    }
  });

  const modes: ModeName[] = modeSet.size ? [...modeSet] : ["default"];
  const defaultMode = modes.includes("light") ? "light" : modes[0];

  const tokens: TokenTree = {};
  for (const [path, byBucket] of collected) {
    const modeValues: Record<string, string> = {};
    for (const mode of modes) {
      const v = byBucket.get(mode) ?? byBucket.get(":root");
      if (v !== undefined) modeValues[mode] = v;
    }
    const distinct = new Set(Object.values(modeValues));
    if (modeSet.size === 0) {
      // No data-theme blocks: everything is a :root scalar.
      setDeep(tokens as Record<string, unknown>, path, { $value: byBucket.get(":root") });
    } else if (distinct.size <= 1 && Object.keys(modeValues).length === modes.length) {
      // Same value across all modes -> mode-agnostic scalar.
      setDeep(tokens as Record<string, unknown>, path, { $value: [...distinct][0] });
    } else {
      setDeep(tokens as Record<string, unknown>, path, { $value: modeValues });
    }
  }

  const modeDefs: ModeDefinition[] = modes.map((m) => ({ name: m }));
  return {
    theme: { name, modes: modeDefs, defaultMode, tokens },
    discoveredModes: [...modeSet],
  };
}
