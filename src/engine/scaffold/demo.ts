/**
 * generate_demo (PLAN §6 tool 8, §8.1). Produces a showcase that
 *  - renders every token (color swatches, spacing/radius/shadow scales,
 *    typography samples) and every governed component,
 *  - across ALL enabled color modes AND every typeface pack (two independent
 *    live switchers + side-by-side panels for each axis),
 *  - and stays validator-clean: colors are referenced via `var(--token)` only.
 *
 * NOT fully self-contained: when the theme declares Google-font type-packs, the
 * page <head> links fonts.googleapis.com. Offline, packs fall back to their
 * system stacks (the page still works, just without the web "vibe" fonts).
 *
 * Layout discipline (keeps the page golden):
 *  - colors ONLY via `var(--token)`; token *paths* are printed as text, never
 *    resolved color/shadow values (a printed `#…` would fail the hex check),
 *  - color modes via `[data-theme]`, typefaces via `[data-type]` (no `.dark`,
 *    no `prefers-color-scheme` here — single mode strategy),
 *  - interactive widgets are ONLY the governed `.btn`/`.input`; demo.css adds no
 *    partial pseudo-state rules, so the flagship interactive rule stays quiet.
 */

import { ModeName, ThemeDefinition } from "../tokens/types.js";
import { cssVarName } from "../adapters/css-vars/naming.js";
import { emitCssVars, emitComponentCss, emitTypeThemeCss, googleFontsLinks } from "../adapters/css-vars/emit.js";
import { emitSwitcherJs } from "./switcher.js";
import { GeneratedFile } from "../util/files.js";

export interface DemoOptions {
  stack: "css-vars" | "vanilla";
  modes?: ModeName[];
}

export interface DemoResult {
  modes: ModeName[];
  defaultMode: ModeName;
  files: GeneratedFile[];
}

/** A flattened token leaf carrying its DTCG type, inherited from ancestors. */
interface Leaf {
  path: string;
  type?: string;
  value: unknown;
}

/**
 * Flatten the token tree, propagating the group-level `$type` down to leaves
 * (DTCG type inheritance). The shared `flattenTokens` deliberately drops group
 * `$type`, so the demo carries its own walk to select scales by type.
 */
function collectLeaves(
  tree: Record<string, unknown>,
  prefix = "",
  inherited?: string
): Leaf[] {
  const out: Leaf[] = [];
  const groupType = typeof tree.$type === "string" ? tree.$type : inherited;
  for (const [key, node] of Object.entries(tree)) {
    if (key.startsWith("$")) continue;
    if (!node || typeof node !== "object") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const obj = node as Record<string, unknown>;
    if ("$value" in obj) {
      const type = typeof obj.$type === "string" ? (obj.$type as string) : groupType;
      out.push({ path, type, value: obj.$value });
    } else {
      out.push(...collectLeaves(obj, path, groupType));
    }
  }
  return out;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A primitive's literal value, but only when it is safe to print as text. */
function valueText(value: unknown): string {
  if (typeof value === "number") return String(value);
  // Skip references ("{…}"), composites (objects), and anything with a `#`
  // (resolved color/shadow values would trip the golden-fixture hex check).
  if (typeof value === "string" && !value.includes("#") && !value.includes("{")) {
    return value;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function section(eyebrow: string, title: string, desc: string, body: string): string {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `<section class="section" id="${id}">
    <div class="section__head">
      <span class="eyebrow">${eyebrow}</span>
      <h2>${title}</h2>
      <p class="section__desc">${desc}</p>
    </div>
    ${body}
  </section>`;
}

function swatch(path: string): string {
  const label = path.replace(/^color\./, "");
  return `<figure class="swatch" title="${esc(path)}">
      <span class="swatch__chip" style="background:var(${cssVarName(path)})"></span>
      <figcaption class="swatch__name">${esc(label)}</figcaption>
    </figure>`;
}

function paletteSection(leaves: Leaf[]): string {
  const items = leaves
    .filter((l) => l.type === "color" && typeof l.value === "string")
    .map((l) => swatch(l.path))
    .join("\n");
  return section(
    "Color",
    "Palette",
    "Primitive color scale — the raw values. Components never reference these directly; they go through semantic roles.",
    `<div class="swatch-grid">${items}</div>`
  );
}

const SEMANTIC_GROUPS: Array<[string, string]> = [
  ["bg", "Background"],
  ["text", "Text"],
  ["border", "Border"],
  ["action", "Action"],
];

function semanticColorSection(leaves: Leaf[]): string {
  const semantic = leaves.filter(
    (l) => l.type === "color" && typeof l.value === "object"
  );
  const groups = SEMANTIC_GROUPS.map(([key, title]) => {
    const items = semantic.filter((l) => l.path.split(".")[1] === key);
    if (!items.length) return "";
    return `<div class="group">
        <h3 class="group__title">${title}</h3>
        <div class="swatch-grid">${items.map((l) => swatch(l.path)).join("\n")}</div>
      </div>`;
  }).join("\n");
  return section(
    "Color",
    "Semantic roles",
    "Role-based tokens that swap per mode. These are what components and app code must use — switch the mode and every surface follows.",
    groups
  );
}

/** A scale row with a visual demo + token path + (optional) literal value. */
function metric(visual: string, path: string, value: string): string {
  const valHtml = value ? `<span class="metric__val">${esc(value)}</span>` : "";
  return `<div class="metric">
      <div class="metric__demo">${visual}</div>
      <div class="metric__info"><code class="metric__path">${esc(path)}</code>${valHtml}</div>
    </div>`;
}

function spacingSection(leaves: Leaf[]): string {
  const items = leaves
    .filter((l) => l.path.split(".")[0] === "space" && l.path.split(".").length === 2)
    .map((l) =>
      metric(
        `<span class="bar" style="width:var(${cssVarName(l.path)})"></span>`,
        l.path,
        valueText(l.value)
      )
    )
    .join("\n");
  return section(
    "Dimension",
    "Spacing",
    "The spacing scale, used for padding, gaps and layout rhythm.",
    `<div class="metrics">${items}</div>`
  );
}

function radiusSection(leaves: Leaf[]): string {
  const items = leaves
    .filter((l) => l.path.split(".")[0] === "radius" && l.path.split(".").length === 2)
    .map((l) =>
      metric(
        `<span class="radius-box" style="border-radius:var(${cssVarName(l.path)})"></span>`,
        l.path,
        valueText(l.value)
      )
    )
    .join("\n");
  return section(
    "Dimension",
    "Radius",
    "Corner-radius scale for controls and surfaces.",
    `<div class="metrics">${items}</div>`
  );
}

function shadowSection(leaves: Leaf[]): string {
  const items = leaves
    .filter((l) => l.type === "shadow" && l.path.split(".")[0] === "shadow")
    .map((l) =>
      metric(
        `<span class="shadow-box" style="box-shadow:var(${cssVarName(l.path)})"></span>`,
        l.path,
        ""
      )
    )
    .join("\n");
  return section(
    "Elevation",
    "Shadow",
    "Elevation scale — applied via box-shadow to lift surfaces off the page.",
    `<div class="metrics">${items}</div>`
  );
}

function typographySection(leaves: Leaf[]): string {
  const items = leaves
    .filter((l) => l.type === "fontSize" && l.path.split(".")[0] === "font")
    .map((l) => {
      const sample = `<div class="type-row__sample" style="font-size:var(${cssVarName(l.path)})">The quick brown fox jumps over the lazy dog</div>`;
      const value = valueText(l.value);
      const valHtml = value ? `<span class="metric__val">${esc(value)}</span>` : "";
      return `<div class="type-row">
        ${sample}
        <div class="metric__info"><code class="metric__path">${esc(l.path)}</code>${valHtml}</div>
      </div>`;
    })
    .join("\n");
  return section(
    "Type",
    "Typography",
    "Font-size scale, rendered in the system sans stack.",
    `<div class="type-list">${items}</div>`
  );
}

function componentsSection(): string {
  return section(
    "Components",
    "Components",
    "Governed components — copy these blueprints verbatim. Every interactive state is covered in every mode.",
    `<div class="card">
      <p class="card__title">Card surface with the governed components.</p>
      <div class="btn-row">
        <button class="btn btn--primary" type="button">Primary</button>
        <button class="btn btn--secondary" type="button">Secondary</button>
        <button class="btn btn--danger" type="button">Danger</button>
        <button class="btn btn--primary" type="button" disabled>Disabled</button>
      </div>
      <label class="field">Email<input class="input" type="email" placeholder="you@example.com" /></label>
    </div>`
  );
}

/** A read-only panel showing every mode at once, each in its own data-theme scope. */
function sideBySideSection(modes: ModeName[]): string {
  const panels = modes
    .map(
      (m) => `<div class="mode-card" data-theme="${m}">
      <div class="mode-card__bar"><code>${esc(m)}</code></div>
      <div class="mode-card__body">
        <div class="btn-row">
          <button class="btn btn--primary" type="button">Primary</button>
          <button class="btn btn--secondary" type="button">Secondary</button>
          <button class="btn btn--primary" type="button" disabled>Disabled</button>
        </div>
        <label class="field">Field<input class="input" placeholder="text" /></label>
      </div>
    </div>`
    )
    .join("\n");
  return section(
    "Modes",
    "All modes side-by-side",
    "The same governed components rendered in every enabled mode at once — the at-a-glance proof that nothing drifts between modes.",
    `<div class="modes">${panels}</div>`
  );
}

/** Showcase the TYPEFACE axis: each font-pack rendered in its own data-type scope. */
function typefaceSection(theme: ThemeDefinition): string {
  const packs = theme.typeThemes ?? [];
  if (!packs.length) return "";
  const cards = packs
    .map(
      (p) => `<div class="mode-card" data-type="${esc(p.name)}">
      <div class="mode-card__bar"><code>${esc(p.name)}</code></div>
      <div class="mode-card__body">
        <div class="type-specimen">
          <div class="type-specimen__big">Aa Gg Qq 0123</div>
          <p>The quick brown fox jumps over the lazy dog.</p>
          <code>const pack = "${esc(p.name)}";</code>
        </div>
      </div>
    </div>`
    )
    .join("\n");
  return section(
    "Type",
    "Typefaces",
    "An independent axis from color. Pick a font-pack with the Type switcher — it repoints --font-family-sans/mono so the whole UI follows, composing freely with any mode. Web fonts load from Google Fonts; offline they fall back to system stacks.",
    `<div class="modes">${cards}</div>`
  );
}

// ---------------------------------------------------------------------------
// Layout CSS (tokens only for color/elevation; raw px allowed for pure layout).
// ---------------------------------------------------------------------------

const DEMO_CSS = `/* Generated by dsmcp — demo layout. Colors/elevation via tokens only (no
 * hardcoded values). Modes switch via [data-theme]; no interactive pseudo-state
 * rules here, so the governed .btn/.input stay the single source of states. */

*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--color-bg-default);
  color: var(--color-text-primary);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-md);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
code { font-family: var(--font-family-mono); }

/* Header --------------------------------------------------------------- */
.site-header {
  position: sticky; top: 0; z-index: 10;
  background: var(--color-bg-default);
  border-bottom: 1px solid var(--color-border-default);
}
.site-header__inner {
  max-width: 1120px; margin: 0 auto;
  padding: var(--space-4) var(--space-6);
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
}
.brand { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
.brand__mark {
  flex: none; width: var(--space-10); height: var(--space-10);
  border-radius: var(--radius-md);
  background: var(--color-action-primary-bg);
}
.brand__name { font-weight: var(--font-weight-bold); font-size: var(--font-size-lg); line-height: 1.2; }
.brand__sub { color: var(--color-text-muted); font-size: var(--font-size-sm); }

/* Switcher (injected at runtime; base styling only — never classified as
 * interactive because the selector has no element prefix). */
.dsmcp-switcher {
  font: inherit;
  color: var(--color-text-primary);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-control);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

/* Page + sections ------------------------------------------------------ */
.page { max-width: 1120px; margin: 0 auto; padding: var(--space-8) var(--space-6) var(--space-16); }
.intro h1 { font-size: var(--font-size-2xl); margin: 0 0 var(--space-3); line-height: 1.15; }
.lede { color: var(--color-text-secondary); font-size: var(--font-size-lg); max-width: 70ch; margin: 0; }

.section { margin-top: var(--space-16); padding-top: var(--space-8); border-top: 1px solid var(--color-border-subtle); }
.section__head { margin-bottom: var(--space-6); }
.eyebrow {
  display: inline-block; text-transform: uppercase; letter-spacing: 0.08em;
  font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted); margin-bottom: var(--space-2);
}
.section__head h2 { font-size: var(--font-size-xl); margin: 0; line-height: 1.2; }
.section__desc { color: var(--color-text-secondary); margin: var(--space-2) 0 0; max-width: 70ch; }
.group { margin-top: var(--space-6); }
.group__title {
  font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--color-text-muted); font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--space-3);
}

/* Swatches ------------------------------------------------------------- */
.swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-4);
}
.swatch {
  margin: 0; min-width: 0;
  background: var(--color-bg-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--elevation-card);
}
.swatch__chip {
  display: block; height: var(--space-16);
  border-bottom: 1px solid var(--color-border-subtle);
}
.swatch__name {
  display: block; max-width: 100%;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-family-mono); font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Metric scales (spacing / radius / shadow) ---------------------------- */
.metrics { display: flex; flex-direction: column; gap: var(--space-3); }
.metric {
  display: flex; align-items: center; gap: var(--space-6); min-width: 0;
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
}
.metric__demo { flex: 0 0 220px; display: flex; align-items: center; min-width: 0; }
.bar {
  display: block; height: var(--space-4); min-width: 2px;
  background: var(--color-action-primary-bg);
  border-radius: var(--radius-full);
}
.radius-box {
  display: block; width: var(--space-12); height: var(--space-12);
  background: var(--color-action-primary-bg);
}
.shadow-box {
  display: block; width: var(--space-16); height: var(--space-12);
  background: var(--color-bg-raised);
  border-radius: var(--radius-md);
}
.metric__info { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
.metric__path { font-size: var(--font-size-sm); color: var(--color-text-primary); }
.metric__val { font-size: var(--font-size-xs); color: var(--color-text-muted); }

/* Typography ----------------------------------------------------------- */
.type-list { display: flex; flex-direction: column; gap: var(--space-2); }
.type-row {
  display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-6);
  flex-wrap: wrap;
  padding: var(--space-4) 0; border-bottom: 1px solid var(--color-border-subtle);
}
.type-row__sample { min-width: 0; line-height: 1.3; color: var(--color-text-primary); }
.type-row .metric__info { text-align: right; flex: none; }

/* Components card ------------------------------------------------------ */
.card__title { margin: 0 0 var(--space-4); color: var(--color-text-secondary); }
.btn-row { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
.field {
  display: flex; flex-direction: column; gap: var(--space-2);
  margin-top: var(--space-5);
  color: var(--color-text-secondary); font-size: var(--font-size-sm);
}

/* Side-by-side modes --------------------------------------------------- */
.modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-5);
}
.mode-card {
  min-width: 0; overflow: hidden;
  background: var(--color-bg-default);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-card);
}
.mode-card__bar {
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-secondary); font-size: var(--font-size-xs);
}
.mode-card__body { padding: var(--space-5); }
.mode-card .field { color: var(--color-text-secondary); }

/* Switchers (Mode + Type) --------------------------------------------- */
.switchers { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
.switcher-field { display: flex; align-items: center; gap: var(--space-2); }
.switcher-field__label {
  font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--color-text-muted); font-weight: var(--font-weight-semibold);
}

/* Typeface specimens --------------------------------------------------- */
.type-specimen { font-family: var(--font-family-sans); min-width: 0; }
.type-specimen__big {
  font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);
  line-height: 1.1; margin-bottom: var(--space-2);
}
.type-specimen p { margin: var(--space-2) 0 0; color: var(--color-text-secondary); }
.type-specimen code {
  display: block; margin-top: var(--space-3);
  color: var(--color-text-muted); font-size: var(--font-size-sm);
}
`;

/**
 * Favicon — dsmcp's mark: a light/dark "contrast disc" (the universal mode
 * symbol — dsmcp's core is mode-aware theming) on a brand-accent rounded square.
 * Static SVG (scales crisply, no binary); colors are literal by design.
 */
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="dsmcp">
  <rect width="32" height="32" rx="7" fill="#2563eb"/>
  <circle cx="16" cy="16" r="8.5" fill="#ffffff"/>
  <path d="M16 7.5a8.5 8.5 0 0 1 0 17z" fill="#0b1220"/>
</svg>
`;

function demoHtml(theme: ThemeDefinition, modes: ModeName[]): string {
  const leaves = collectLeaves(theme.tokens as unknown as Record<string, unknown>);
  const typeCount = theme.typeThemes?.length ?? 0;
  const typeSwitcher = typeCount > 0;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(theme.name)} — design system</title>
  <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
${googleFontsLinks(theme)}
  <link rel="stylesheet" href="./tokens.css" />
  <link rel="stylesheet" href="./components.css" />
  <link rel="stylesheet" href="./demo.css" />
  <script src="./theme.js"></script>
</head>
<body>
  <header class="site-header">
    <div class="site-header__inner">
      <div class="brand">
        <span class="brand__mark"></span>
        <div>
          <div class="brand__name">${esc(theme.name)}</div>
          <div class="brand__sub">Design system · living documentation</div>
        </div>
      </div>
      <div class="switchers">
        <span class="switcher-field"><span class="switcher-field__label">Mode</span><span id="dsmcp-theme-switcher"></span></span>
        ${typeSwitcher ? `<span class="switcher-field"><span class="switcher-field__label">Type</span><span id="dsmcp-type-switcher"></span></span>` : ""}
      </div>
    </div>
  </header>
  <main class="page">
    <div class="intro">
      <h1>Design tokens &amp; components</h1>
      <p class="lede">Every token and governed component across ${modes.length} color mode${modes.length === 1 ? "" : "s"}${typeSwitcher ? ` × ${typeCount} typeface${typeCount === 1 ? "" : "s"}` : ""} — two independent axes. Generated by dsmcp; colors stay validator-clean (zero hardcoded values).</p>
    </div>
    ${paletteSection(leaves)}
    ${semanticColorSection(leaves)}
    ${spacingSection(leaves)}
    ${radiusSection(leaves)}
    ${shadowSection(leaves)}
    ${typographySection(leaves)}
    ${typefaceSection(theme)}
    ${componentsSection()}
    ${sideBySideSection(modes)}
  </main>
</body>
</html>
`;
}

export function generateDemo(theme: ThemeDefinition, opts: DemoOptions): DemoResult {
  if (opts.stack !== "css-vars" && opts.stack !== "vanilla") {
    throw new Error(`demo for stack '${opts.stack}' is not supported (css-vars / vanilla only)`);
  }
  const modes = opts.modes && opts.modes.length ? opts.modes : theme.modes.map((m) => m.name);
  const defaultMode = modes.includes(theme.defaultMode) ? theme.defaultMode : modes[0];

  const typeThemes = theme.typeThemes?.map((t) => t.name);
  const files: GeneratedFile[] = [
    { path: "tokens.css", content: emitCssVars(theme, modes, defaultMode) + emitTypeThemeCss(theme) },
    { path: "components.css", content: emitComponentCss("css-vars") },
    { path: "theme.js", content: emitSwitcherJs({ modes, defaultMode, typeThemes, defaultTypeTheme: theme.defaultTypeTheme }) },
    { path: "demo.css", content: DEMO_CSS },
    { path: "favicon.svg", content: FAVICON_SVG },
    { path: "index.html", content: demoHtml(theme, modes) },
  ];
  return { modes, defaultMode, files };
}
