# dsmcp — Theme Governance MCP

A **governance** system (contract + enforcement) that makes AI use fixed
**tokens / components / rules** instead of guessing styles — so new projects
come out in the right mode, consistent, with no drift. See [PLAN.md](PLAN.md)
for the full design.

> **"AI can call a tool" ≠ "AI complies."** The engine is pure TypeScript and is
> exposed through three façades: **MCP** (suggestion), **CLI** and **hooks/CI**
> (deterministic enforcement). All logic lives in `src/engine/`; nothing there
> imports the MCP SDK.

## Status — Phases 0–5 ✅ (all 4 stacks; PLAN.md complete)

- **Phase 0** — DTCG N-mode token model (`{ [mode]: value }` + `extends`),
  resolver with missing-mode / circular-ref / dangling-ref detection, default
  full-design-system theme, `get_contract` over MCP stdio + CLI.
- **Phase 1** — `list_tokens`, `resolve_token`, `get_component_spec`
  (governed button/input/card blueprints with full interactive-state matrix).
- **Phase 2** — `scaffold_theme` (tokens.css + components.css + N-mode switcher:
  toggle for 2 modes / dropdown for >2, `prefers-color-scheme` + localStorage),
  adoption artifacts (CLAUDE.md/.cursorrules/config/pre-commit/CI/Stop-hook,
  guarded), `generate_demo` showcase. Default theme ships **18 modes** — the
  full PLAN catalog: 10 functional (§11.1: light, dark, dim, midnight,
  high-contrast-light/dark, sepia, solarized-light/dark, nord) + 8 aesthetic
  (§11.2: love, future, synthwave, sakura, forest, ocean, coffee, aurora), each
  inheriting a light/dark base via `extends` and **passing WCAG AA contrast in
  every mode**. A second, **independent TYPEFACE axis** (`[data-type]`, switched
  separately from color) ships 6 font-packs — system / serif / mono / rounded /
  humanist / slab — that repoint `--font-family-sans|mono` so the whole UI
  follows; web stacks load the fonts from Google Fonts with system fallbacks.
  Example in `examples/css-vars/`.

- **Phase 3a** — rule engine: `no-raw-color` (postcss, definition-vs-usage),
  `single-mode-strategy`, `mode-completeness`, `contrast-aa` (WCAG AA in every
  mode); `validate_code` / `validate_project` / `suggest_fix` + compliance score.
  `validate` exits 0/1 (activates the generated hooks). The default theme's
  dark/hc action colors were fixed so the demo passes the checker **100%**.

- **Phase 3b** — ⭐ flagship `interactive-completeness`: element-type-aware
  state-selector coverage with selector-family grouping (`.btn` covers
  `.btn--*`), CSS/`<style>` only, conservative signals (button/a/input/select/
  textarea + governed `.btn`/`.input`), escape hatch
  `/* dsmcp-ignore interactive-completeness: <reason> */`. On css-vars, covering
  a state covers every mode (vars swap under `[data-theme]`), so this stays a
  pure coverage check. Proven: 0 findings on dsmcp's own output.

- **Phase 4a** — multi-stack: **vanilla** (thin alias over the css-vars emitter)
  and **tailwind** (reuses `tokens.css`; a preset maps semantic tokens →
  `var(--x)`, so utilities like `bg-bg-default` are mode-aware). Rules are now
  **stack-aware** via `appliesTo` + a detector registry: Tailwind gets its own
  `no-raw-class` (palette utilities in markup) + `interactive-completeness-tailwind`
  (state variants `hover:`/`focus-visible:`/…), and css-vars rules never run
  (and vacuously pass) a Tailwind project. Examples in `examples/{vanilla,tailwind}/`.

- **Phase 4b** — `import_theme` (CSS `:root`/`[data-theme]` → DTCG, the inverse
  of the emitter; or a parsed `tailwind.config` palette → DTCG) and
  `register_theme` (validate a caller's DTCG theme). Both **report gaps**
  (missing modes, contrast) instead of throwing. Figma importer deferred (§13).

- **Phase 5** — Flutter adapter (a different engine: no CSS). Scaffolds an
  N-mode `Map<String, ThemeData>` (+ a `ThemeController`) from tokens, and a
  `no-raw-color-dart` rule flags `Color(0x…)` (outside a `// dsmcp:generated`
  theme source) and `Colors.<name>` palette usage. Stack-aware adoption
  artifacts. _Note: generated Dart is structurally emitted + validated but not
  compile-verified (no Dart toolchain here)._

**11 MCP tools live** (every tool in PLAN §6): `get_contract`, `list_tokens`,
`resolve_token`, `get_component_spec`, `scaffold_theme`, `generate_demo`,
`validate_code`, `validate_project`, `suggest_fix`, `import_theme`,
`register_theme`.

**PLAN.md is complete** across all 4 stacks, including the full 18-mode catalog
(§11.1 functional + §11.2 aesthetic packs) and an independent typeface axis.
Deferred by design: the Figma importer (§13 open question), a Flutter
interactive-states rule (§5 only specified the color-literal rule for Flutter),
and per-pack Flutter fonts. Possible follow-ups: HTTP transport.

## Install

```bash
npm install -g dsmcp        # CLI on your PATH as `dsmcp`
# or, no install:
npx dsmcp doctor
```

Use the engine as a library:

```js
import { loadDefaultTheme, scaffoldTheme, validateProject } from "dsmcp";
```

## Develop

```bash
npm install
npm test    # build + MCP stdio smoke (all 11 tools) + scaffold/demo/typeface coherence

# CLI
node dist/cli.js doctor                       # self-check the default theme
node dist/cli.js contract --stack css-vars [--json]
node dist/cli.js list-tokens --category color
node dist/cli.js resolve color.bg.default --mode dark
node dist/cli.js component button
node dist/cli.js scaffold --out ./examples/css-vars
node dist/cli.js demo --out ./examples/css-vars/demo
node dist/cli.js validate ./examples/css-vars          # exit 1 on errors
node dist/cli.js report ./examples/css-vars --json     # always exit 0 (CI artifact)
```

## Use as an MCP server

`.mcp.json` (installed package — uses the `dsmcp-mcp` bin):

```json
{
  "mcpServers": {
    "dsmcp": { "command": "npx", "args": ["-y", "dsmcp-mcp"] }
  }
}
```

Local checkout instead:

```json
{
  "mcpServers": {
    "dsmcp": { "command": "node", "args": ["dist/mcp/server.js"] }
  }
}
```

## Layout

```
src/engine/    pure core (tokens, resolver, contract) — no MCP/CLI deps
src/mcp/       MCP stdio façade
src/cli.ts     CLI façade
themes/default DTCG default theme + typefaces.json
test/          smoke + fixtures
```

## Publish

See [RELEASE.md](RELEASE.md) for the full first-release checklist (metadata,
pre-flight checks, `npm publish`, tagging).
