/**
 * CSS-vars adapter — naming convention (PLAN §10, stack css-vars).
 *
 * Maps a DTCG token path to a CSS custom property name and renders resolved
 * values to CSS. Shared by component specs (Phase 1) and the scaffold emitter
 * (Phase 2) so the variable names always match.
 */

import { ScalarValue } from "../../tokens/types.js";

/** `color.bg.default` -> `--color-bg-default`. */
export function cssVarName(path: string): string {
  return "--" + path.replace(/\./g, "-");
}

/** `color.bg.default` -> `var(--color-bg-default)`. */
export function cssVarRef(path: string): string {
  return `var(${cssVarName(path)})`;
}

/** Render a resolved token value to a CSS value string. */
export function toCssValue(value: ScalarValue): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    // cubicBezier: [x1,y1,x2,y2] -> cubic-bezier(...)
    if (value.length === 4 && value.every((n) => typeof n === "number")) {
      return `cubic-bezier(${value.join(", ")})`;
    }
    return value.map((v) => toCssValue(v as ScalarValue)).join(", ");
  }
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    // shadow composite: { color, offsetX, offsetY, blur, spread }
    if ("offsetX" in o && "blur" in o) {
      return `${o.offsetX} ${o.offsetY} ${o.blur} ${o.spread ?? "0px"} ${o.color}`.trim();
    }
    // fallback: space-join values
    return Object.values(o).map((v) => toCssValue(v as ScalarValue)).join(" ");
  }
  return String(value);
}
