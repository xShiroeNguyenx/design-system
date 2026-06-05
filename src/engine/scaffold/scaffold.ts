/**
 * scaffold_theme (PLAN §6 tool 4, §8). Generates the theme foundation +
 * adoption artifacts for a stack. Generation is pure (returns file contents);
 * callers write them with `writeFiles`.
 *
 * Phase 2 implements the css-vars stack. Other stacks land in Phase 4.
 */

import { ModeName, Stack, ThemeDefinition } from "../tokens/types.js";
import { GeneratedFile } from "../util/files.js";
import { emitCssVars, emitComponentCss, emitTypeThemeCss, googleFontsLinks } from "../adapters/css-vars/emit.js";
import {
  emitTailwindPreset,
  emitTailwindConfig,
  emitTailwindComponentsDoc,
  emitTailwindStarter,
} from "../adapters/tailwind/emit.js";
import { emitFlutterTheme, emitFlutterController } from "../adapters/flutter/emit.js";
import { emitSwitcherJs } from "./switcher.js";
import { buildArtifacts } from "./artifacts.js";

export interface ScaffoldOptions {
  stack: Stack;
  /** Modes to enable; defaults to all declared modes. Must be a declared subset. */
  modes?: ModeName[];
  /** dsmcp invocation used in generated enforcement scripts. */
  invoke?: string;
}

export interface ScaffoldResult {
  stack: Stack;
  modes: ModeName[];
  defaultMode: ModeName;
  /** "toggle" for 2 modes, "dropdown" for >2 (PLAN §8). */
  switcherKind: "toggle" | "dropdown";
  files: GeneratedFile[];
}

function resolveModes(theme: ThemeDefinition, requested?: ModeName[]): ModeName[] {
  const declared = theme.modes.map((m) => m.name);
  if (!requested || requested.length === 0) return declared;
  const unknown = requested.filter((m) => !declared.includes(m));
  if (unknown.length) {
    throw new Error(
      `Unknown mode(s): ${unknown.join(", ")}. Declared: ${declared.join(", ")}`
    );
  }
  return requested;
}

const STARTER_HTML = (modes: ModeName[], theme: ThemeDefinition): string => {
  const fonts = googleFontsLinks(theme);
  const hasType = !!(theme.typeThemes && theme.typeThemes.length);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>App (dsmcp themed)</title>
${fonts}
  <link rel="stylesheet" href="./theme/tokens.css" />
  <link rel="stylesheet" href="./theme/components.css" />
  <style>
    /* App chrome uses ONLY tokens — no hardcoded values. */
    body { margin: 0; background: var(--color-bg-default); color: var(--color-text-primary);
           font-family: var(--font-family-sans); font-size: var(--font-size-md); }
    main { max-width: 720px; margin: 0 auto; padding: var(--space-8); }
    .toolbar { display: flex; gap: var(--space-4); justify-content: flex-end; padding: var(--space-4); }
  </style>
  <script src="./theme/theme.js"></script>
</head>
<body>
  <div class="toolbar"><span id="dsmcp-theme-switcher"></span>${hasType ? `<span id="dsmcp-type-switcher"></span>` : ""}</div>
  <main>
    <h1>Themed app</h1>
    <p>Modes: ${modes.join(", ")}${hasType ? ` · Typefaces: ${theme.typeThemes!.map((t) => t.name).join(", ")}` : ""}. Edit tokens, not components.</p>
    <div class="card">
      <p>Card surface.</p>
      <button class="btn btn--primary" type="button">Primary</button>
      <button class="btn btn--secondary" type="button">Secondary</button>
      <button class="btn btn--danger" type="button">Danger</button>
    </div>
  </main>
</body>
</html>
`;
};

export function scaffoldTheme(theme: ThemeDefinition, opts: ScaffoldOptions): ScaffoldResult {
  const { stack } = opts;
  const modes = resolveModes(theme, opts.modes);
  const defaultMode = modes.includes(theme.defaultMode) ? theme.defaultMode : modes[0];
  const switcherKind: "toggle" | "dropdown" = modes.length === 2 ? "toggle" : "dropdown";
  const artifacts = buildArtifacts({ stack, modes, defaultMode, invoke: opts.invoke });

  // Flutter is a distinct branch: no CSS vars / no data-theme — Dart files only.
  if (stack === "flutter") {
    const files: GeneratedFile[] = [
      { path: "lib/theme/app_theme.dart", content: emitFlutterTheme(theme, modes, defaultMode) },
      { path: "lib/theme/theme_controller.dart", content: emitFlutterController() },
      ...artifacts,
    ];
    return { stack, modes, defaultMode, switcherKind, files };
  }

  // Web stacks: mode-scoped vars + the data-theme switcher are shared. The
  // typeface axis ([data-type] blocks + the second switcher) rides along too.
  const typeThemes = theme.typeThemes?.map((t) => t.name);
  const shared: GeneratedFile[] = [
    { path: "theme/tokens.css", content: emitCssVars(theme, modes, defaultMode) + emitTypeThemeCss(theme) },
    { path: "theme/theme.js", content: emitSwitcherJs({ modes, defaultMode, typeThemes, defaultTypeTheme: theme.defaultTypeTheme }) },
    ...artifacts,
  ];

  let stackFiles: GeneratedFile[];
  if (stack === "css-vars" || stack === "vanilla") {
    stackFiles = [
      { path: "theme/components.css", content: emitComponentCss(stack) },
      { path: "index.html", content: STARTER_HTML(modes, theme), preserveExisting: true },
    ];
  } else {
    // tailwind: reuse tokens.css; map semantic tokens to vars via a preset.
    stackFiles = [
      { path: "tailwind.preset.js", content: emitTailwindPreset(theme) },
      { path: "tailwind.config.js", content: emitTailwindConfig() },
      { path: "COMPONENTS.md", content: emitTailwindComponentsDoc() },
      { path: "index.html", content: emitTailwindStarter(modes, theme), preserveExisting: true },
    ];
  }

  return { stack, modes, defaultMode, switcherKind, files: [...shared, ...stackFiles] };
}
