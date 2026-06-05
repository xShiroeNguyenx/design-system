/**
 * DTCG-flavored token model with N-mode awareness.
 *
 * Three layers (see PLAN §4):
 *  1. primitive  — raw palette/scale (literal values, never mode-varying)
 *  2. semantic   — role-based, mode-aware  ({ [mode]: value })
 *  3. component  — per-component, points at semantic tokens, state matrix
 *
 * Token format follows the Design Tokens Community Group (DTCG) JSON spec:
 * each leaf is `{ $type, $value, $description? }`, references use `{a.b.c}`.
 * Mode-variance is layered on top: a `$value` may be a *mode map* —
 * a plain object whose keys are all declared mode names.
 */

export type ModeName = string;

/** A declared mode. A mode may `extends` another to inherit + override. */
export interface ModeDefinition {
  name: ModeName;
  /** Inherit all tokens from this mode, overriding only what differs. */
  extends?: ModeName;
  description?: string;
}

/** DTCG token `$type`s we support. */
export type TokenType =
  | "color"
  | "dimension"
  | "number"
  | "fontFamily"
  | "fontWeight"
  | "fontSize"
  | "lineHeight"
  | "letterSpacing"
  | "duration"
  | "cubicBezier"
  | "shadow"
  | "typography"
  | "string";

/** A reference to another token, DTCG-style: `"{color.bg.default}"`. */
export type Reference = string;

/** A non-mode-varying value: literal scalar, reference, or composite object. */
export type ScalarValue = string | number | Reference | Record<string, unknown>;

/** Per-mode value map. Keys MUST all be declared mode names. */
export type ModeMap = Record<ModeName, ScalarValue>;

/** A token leaf. `$value` is either a single value or a per-mode map. */
export interface TokenNode {
  $type?: TokenType;
  $value: ScalarValue | ModeMap;
  $description?: string;
  $extensions?: Record<string, unknown>;
}

/** A group node: nested tokens. `$type` here is inherited by children. */
export interface GroupNode {
  $type?: TokenType;
  $description?: string;
  [key: string]:
    | TokenNode
    | GroupNode
    | TokenType
    | string
    | undefined;
}

/** Recursive token tree (root of a DTCG document). */
export type TokenTree = {
  [key: string]: TokenNode | GroupNode | TokenTree;
};

/** Type guard: is this a token leaf (has `$value`)? */
export function isTokenNode(node: unknown): node is TokenNode {
  return (
    typeof node === "object" &&
    node !== null &&
    "$value" in (node as Record<string, unknown>)
  );
}

/**
 * A type-theme (font-pack): one entry on the TYPEFACE axis, orthogonal to the
 * color-mode axis. Switched at runtime via `[data-type="<name>"]`, it only
 * repoints the font-family vars (`--font-family-sans` / `--font-family-mono`),
 * so every component follows with no component-CSS change. Sizes/weights/
 * line-heights are deliberately NOT part of a type-theme (keeps layout stable).
 */
export interface TypeThemeDefinition {
  name: string;
  description?: string;
  /** Font stack bound to `--font-family-sans`. */
  sans: string;
  /** Font stack bound to `--font-family-mono`. */
  mono: string;
  /** Optional Google Fonts `family=` specs to load (e.g. "Lora:wght@400;700"). */
  google?: string[];
}

/**
 * A complete theme: the mode declarations + the token document + metadata.
 */
export interface ThemeDefinition {
  name: string;
  description?: string;
  /** All modes declared by this theme. */
  modes: ModeDefinition[];
  /** Default mode (must be one of `modes`). */
  defaultMode: ModeName;
  /** The DTCG token document. */
  tokens: TokenTree;
  /** Typeface axis (font-packs), orthogonal to modes. Optional. */
  typeThemes?: TypeThemeDefinition[];
  /** Default type-theme (must be one of `typeThemes`); the `:root` baseline. */
  defaultTypeTheme?: ModeName;
}

/** Supported target stacks (PLAN §3). */
export type Stack = "css-vars" | "tailwind" | "vanilla" | "flutter";
