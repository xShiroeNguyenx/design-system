/**
 * Default theme loader (PLAN §9).
 *
 * Reads `themes/default/manifest.json` and deep-merges its token files into a
 * single `ThemeDefinition`. Kept transport-agnostic: no MCP, no CLI deps.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { ModeDefinition, ThemeDefinition, TokenTree, TypeThemeDefinition } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repo root, derived from this compiled file's location (dist/engine/tokens). */
function repoRoot(): string {
  // dist/engine/tokens/loader.js -> up 4 = repo root
  return resolve(__dirname, "..", "..", "..");
}

interface Manifest {
  name: string;
  description?: string;
  defaultMode: string;
  modes: ModeDefinition[];
  tokenFiles: string[];
  /** Optional sidecar declaring the typeface axis (font-packs). */
  typefaceFile?: string;
}

interface TypefaceDoc {
  default: string;
  packs: TypeThemeDefinition[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge token trees; leaf objects ($value carriers) replace wholesale. */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (
      isPlainObject(existing) &&
      isPlainObject(value) &&
      !("$value" in existing) &&
      !("$value" in value)
    ) {
      deepMerge(existing, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

/** Load the bundled default theme. `themesDir` overridable for tests. */
export function loadDefaultTheme(themesDir?: string): ThemeDefinition {
  const dir = themesDir ?? join(repoRoot(), "themes", "default");
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Manifest;

  const tokens: TokenTree = {};
  for (const file of manifest.tokenFiles) {
    const tree = JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, unknown>;
    deepMerge(tokens as Record<string, unknown>, tree);
  }

  let typeThemes: TypeThemeDefinition[] | undefined;
  let defaultTypeTheme: string | undefined;
  if (manifest.typefaceFile) {
    const doc = JSON.parse(readFileSync(join(dir, manifest.typefaceFile), "utf8")) as TypefaceDoc;
    typeThemes = doc.packs;
    defaultTypeTheme = doc.default;
  }

  return {
    name: manifest.name,
    description: manifest.description,
    modes: manifest.modes,
    defaultMode: manifest.defaultMode,
    tokens,
    typeThemes,
    defaultTypeTheme,
  };
}
