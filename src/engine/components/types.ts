/**
 * Governed component blueprints (PLAN §6 tool `get_component_spec`).
 *
 * A spec is the "copy this" answer for a component: which tokens it binds to,
 * the required interactive-state matrix, and a per-stack code sample that an AI
 * should copy instead of inventing styles.
 */

import { Stack } from "../tokens/types.js";

/** Interactive states every interactive component must cover (PLAN §5 flagship). */
export const INTERACTIVE_STATES = [
  "default",
  "hover",
  "active",
  "focus-visible",
  "disabled",
] as const;
export type InteractiveState = (typeof INTERACTIVE_STATES)[number];

export interface TokenBinding {
  /** Visual part, e.g. "background", "text", "border", "ring". */
  part: string;
  /** Token path bound to this part for the default state. */
  token: string;
  /** Optional per-state token overrides (state -> token path). */
  states?: Partial<Record<InteractiveState, string>>;
}

export interface ComponentSpec {
  name: string;
  description: string;
  /** True if this is an interactive element (subject to the state matrix). */
  interactive: boolean;
  /** Variants, e.g. ["primary","secondary","danger"]. */
  variants: string[];
  /** Required states (empty for non-interactive). */
  states: InteractiveState[];
  /** Token bindings (per variant when variants exist). */
  bindings: Record<string, TokenBinding[]>;
  notes: string[];
  /** Per-stack governed code sample. */
  code: Partial<Record<Stack, string>>;
}
