/**
 * Default governed component blueprints for the css-vars stack (PLAN §1, §5).
 *
 * The button spec is the direct answer to the plan's core pain — "a few buttons
 * don't follow the mode": every variant binds to mode-varying tokens and
 * defines the full hover/active/focus-visible/disabled matrix. Because the
 * CSS variables are mode-scoped (`:root` / `[data-theme]`, emitted in Phase 2),
 * the component CSS itself is mode-agnostic and cannot drift per mode.
 */

import { Stack } from "../tokens/types.js";
import { ComponentSpec, INTERACTIVE_STATES } from "./types.js";

const BUTTON_CSS = `/* Governed button — copy verbatim. States covered in EVERY mode via mode-scoped vars. */
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--button-padding);
  border: 1px solid transparent;
  border-radius: var(--button-radius);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  line-height: var(--font-lineHeight-normal);
  cursor: pointer;
  transition: background-color var(--motion-exit) var(--easing-standard),
              border-color var(--motion-exit) var(--easing-standard);
}
.btn:disabled { cursor: not-allowed; }
.btn:focus-visible { outline: 2px solid; outline-offset: 2px; }

.btn--primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-fg);
  border-color: var(--button-primary-border);
}
.btn--primary:hover:not(:disabled)  { background: var(--button-primary-hover);  border-color: var(--button-primary-hover); }
.btn--primary:active:not(:disabled) { background: var(--button-primary-active); border-color: var(--button-primary-active); }
.btn--primary:focus-visible         { outline-color: var(--button-primary-focus); }
.btn--primary:disabled              { background: var(--button-primary-disabled); border-color: var(--button-primary-disabled); color: var(--color-text-muted); }

.btn--secondary {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-fg);
  border-color: var(--button-secondary-border);
}
.btn--secondary:hover:not(:disabled)  { background: var(--button-secondary-hover); }
.btn--secondary:active:not(:disabled) { background: var(--button-secondary-active); }
.btn--secondary:focus-visible         { outline-color: var(--button-secondary-focus); }
.btn--secondary:disabled              { background: var(--button-secondary-disabled); color: var(--color-text-muted); }

.btn--danger {
  background: var(--button-danger-bg);
  color: var(--button-danger-fg);
  border-color: var(--button-danger-border);
}
.btn--danger:hover:not(:disabled)  { background: var(--button-danger-hover);  border-color: var(--button-danger-hover); }
.btn--danger:active:not(:disabled) { background: var(--button-danger-active); border-color: var(--button-danger-active); }
.btn--danger:focus-visible         { outline-color: var(--button-danger-focus); }
.btn--danger:disabled              { background: var(--button-danger-disabled); border-color: var(--button-danger-disabled); color: var(--color-text-muted); }`;

const INPUT_CSS = `/* Governed text input — copy verbatim. */
.input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--input-bg);
  color: var(--input-fg);
  border: 1px solid var(--input-border);
  border-radius: var(--input-radius);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-md);
  transition: border-color var(--motion-exit) var(--easing-standard);
}
.input::placeholder { color: var(--input-placeholder); }
.input:hover:not(:disabled)  { border-color: var(--color-text-muted); }
.input:focus-visible         { outline: 2px solid var(--input-focus); outline-offset: 1px; border-color: var(--input-focus); }
.input:disabled              { background: var(--color-bg-subtle); color: var(--color-text-muted); cursor: not-allowed; }`;

const CARD_CSS = `/* Governed card surface — copy verbatim. */
.card {
  background: var(--card-bg);
  color: var(--card-fg);
  border: 1px solid var(--card-border);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  padding: var(--space-inset-lg);
}`;

const BUTTON_TW = `<!-- Governed Tailwind button — copy the class strings. Variants cover every mode
     via the data-theme preset (theme/tokens.css). Use semantic utilities only. -->
<button class="inline-flex items-center gap-2 px-4 py-2 rounded-control font-semibold
  bg-action-primary-bg text-action-primary-fg
  hover:bg-action-primary-hover active:bg-action-primary-active
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-action-primary-focus
  disabled:bg-action-primary-disabled disabled:text-text-muted disabled:cursor-not-allowed">Primary</button>

<button class="inline-flex items-center gap-2 px-4 py-2 rounded-control font-semibold
  bg-action-secondary-bg text-action-secondary-fg
  hover:bg-action-secondary-hover active:bg-action-secondary-active
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-action-secondary-focus
  disabled:bg-action-secondary-disabled disabled:text-text-muted disabled:cursor-not-allowed">Secondary</button>

<button class="inline-flex items-center gap-2 px-4 py-2 rounded-control font-semibold
  bg-action-danger-bg text-action-danger-fg
  hover:bg-action-danger-hover active:bg-action-danger-active
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-action-danger-focus
  disabled:bg-action-danger-disabled disabled:text-text-muted disabled:cursor-not-allowed">Danger</button>`;

const INPUT_TW = `<!-- Governed Tailwind input — semantic utilities, full state matrix. -->
<input class="w-full px-3 py-2 rounded-control bg-bg-raised text-text-primary border border-border-default
  placeholder:text-text-muted hover:border-text-muted
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-action-primary-focus
  disabled:bg-bg-subtle disabled:text-text-muted disabled:cursor-not-allowed" />`;

const CARD_TW = `<!-- Governed Tailwind card (non-interactive). -->
<div class="bg-bg-raised text-text-primary border border-border-default rounded-surface shadow-card p-6">…</div>`;

function buttonVariant(name: string) {
  const states = Object.fromEntries(
    INTERACTIVE_STATES.filter((s) => s !== "default").map((s) => [
      s === "focus-visible" ? "focus-visible" : s,
      `button.${name}.${s === "focus-visible" ? "focus" : s}`,
    ])
  );
  return [
    { part: "background", token: `button.${name}.bg`, states },
    { part: "text", token: `button.${name}.fg` },
    { part: "border", token: `button.${name}.border` },
  ];
}

export const COMPONENT_SPECS: Record<string, ComponentSpec> = {
  button: {
    name: "button",
    description: "Clickable action. Three variants, full interactive-state matrix per mode.",
    interactive: true,
    variants: ["primary", "secondary", "danger"],
    states: [...INTERACTIVE_STATES],
    bindings: {
      primary: buttonVariant("primary"),
      secondary: buttonVariant("secondary"),
      danger: buttonVariant("danger"),
    },
    notes: [
      "Use <button> (or role=button) so :disabled / :focus-visible work natively.",
      "Never hardcode colors; every state pulls a token that is defined in every mode.",
      "focus-visible binds to the *.focus token; disabled binds to *.disabled.",
    ],
    code: { "css-vars": BUTTON_CSS, vanilla: BUTTON_CSS, tailwind: BUTTON_TW },
  },
  input: {
    name: "input",
    description: "Single-line text field with hover/focus/disabled states.",
    interactive: true,
    variants: ["default"],
    states: ["default", "hover", "focus-visible", "disabled"],
    bindings: {
      default: [
        { part: "background", token: "input.bg" },
        { part: "text", token: "input.fg" },
        { part: "border", token: "input.border", states: { "focus-visible": "input.focus" } },
        { part: "placeholder", token: "input.placeholder" },
      ],
    },
    notes: ["Always pair with a <label>.", "Focus ring uses input.focus in every mode."],
    code: { "css-vars": INPUT_CSS, vanilla: INPUT_CSS, tailwind: INPUT_TW },
  },
  card: {
    name: "card",
    description: "Static surface container (non-interactive).",
    interactive: false,
    variants: ["default"],
    states: [],
    bindings: {
      default: [
        { part: "background", token: "card.bg" },
        { part: "text", token: "card.fg" },
        { part: "border", token: "card.border" },
        { part: "shadow", token: "card.shadow" },
      ],
    },
    notes: ["Surface color is mode-varying through card.bg -> color.bg.raised."],
    code: { "css-vars": CARD_CSS, vanilla: CARD_CSS, tailwind: CARD_TW },
  },
};

export function listComponentNames(): string[] {
  return Object.keys(COMPONENT_SPECS);
}

export type GetComponentSpecResult =
  | { ok: true; spec: ComponentSpec; stackSupported: boolean }
  | { ok: false; error: string; available: string[] };

/** Fetch a governed component spec for a stack. */
export function getComponentSpec(name: string, stack: Stack): GetComponentSpecResult {
  const spec = COMPONENT_SPECS[name];
  if (!spec) {
    return { ok: false, error: `Unknown component '${name}'`, available: listComponentNames() };
  }
  return { ok: true, spec, stackSupported: stack in spec.code };
}
