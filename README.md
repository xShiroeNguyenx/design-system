# dsmcp — Theme Governance MCP

[![npm version](https://img.shields.io/npm/v/dsmcp.svg)](https://www.npmjs.com/package/dsmcp)
[![license](https://img.shields.io/npm/l/dsmcp.svg)](LICENSE)
[![node](https://img.shields.io/node/v/dsmcp.svg)](package.json)

**Contract + enforcement that makes AI use fixed design tokens, components and
rules instead of guessing styles** — so generated UIs come out consistent, in
the right mode, with no drift.

> **"AI can call a tool" ≠ "AI complies."** The engine is pure TypeScript exposed
> through three façades: **MCP** (suggestion — the AI calls `get_contract` while
> generating), **CLI**, and **hooks / CI** (deterministic enforcement that runs
> whether or not the AI cooperates). All logic lives in `src/engine/`; nothing
> there imports the MCP SDK.

Status: **v0.1.0 — feature-complete** (Phases 0–5, all 4 stacks). See
[PLAN.md §0](PLAN.md) for the full scope and what's intentionally deferred.

## Features

- **DTCG token model** — 3 layers (primitive → semantic → component), mode-aware
  values with `extends` inheritance. The resolver flags missing-mode, circular,
  and dangling references.
- **18 color modes** out of the box — 10 functional (`light`, `dark`, `dim`,
  `midnight`, high-contrast light/dark, `sepia`, solarized light/dark, `nord`) +
  8 aesthetic (`love`, `future`, `synthwave`, `sakura`, `forest`, `ocean`,
  `coffee`, `aurora`). **Every mode passes WCAG-AA contrast + completeness.**
  Switch via `[data-theme]`.
- **Independent typeface axis** — 6 font-packs (`system`, `serif`, `mono`,
  `rounded`, `humanist`, `slab`) switched **separately** from color via
  `[data-type]`. A pack repoints `--font-family-sans|mono`, so the whole UI
  follows with no component change. Two axes compose freely (mode × typeface).
- **Validator** — `no-raw-color`, `single-mode-strategy`, `mode-completeness`,
  `contrast-aa`, and the ⭐ flagship `interactive-completeness` (every
  interactive element must define hover/active/focus-visible/disabled in every
  mode). Structured findings + a compliance score + `suggest_fix`.
- **4 target stacks** — CSS variables, Tailwind, vanilla CSS, and Flutter. Rules
  are stack-aware, so each stack only runs the rules that apply to it.
- **Scaffolding & adoption** — `scaffold_theme` emits tokens + governed
  components + mode/typeface switchers + adoption artifacts
  (`CLAUDE.md` / `.cursorrules` / pre-commit / GitHub Action / Stop-hook).
  `generate_demo` builds a living showcase of every token across every axis.

## Install

```bash
npm install -g dsmcp     # puts `dsmcp` on your PATH
# or run without installing:
npx dsmcp doctor
```

## Quickstart (CLI)

```bash
dsmcp doctor                              # self-check the bundled theme (all modes resolve + contrast)
dsmcp scaffold --out ./app --stack css-vars   # tokens + components + switchers + adoption files
dsmcp demo --out ./app/demo               # generate the living showcase
dsmcp validate ./app                      # exit 1 if any error → fails commits / CI
dsmcp report ./app --json                 # compliance report (always exit 0; CI artifact)
```

Other lookups: `dsmcp contract --stack css-vars`, `dsmcp list-tokens --category color`,
`dsmcp resolve color.bg.default --mode dark`, `dsmcp component button`.

## Use as an MCP server

Register with Claude Code / Cursor / Claude Desktop via `.mcp.json`:

```json
{
  "mcpServers": {
    "dsmcp": { "command": "npx", "args": ["-y", "dsmcp-mcp"] }
  }
}
```

**11 tools**: `get_contract`, `list_tokens`, `resolve_token`,
`get_component_spec`, `scaffold_theme`, `generate_demo`, `validate_code`,
`validate_project`, `suggest_fix`, `import_theme`, `register_theme`.

## Use as a library

```js
import { loadDefaultTheme, scaffoldTheme, validateProject } from "dsmcp";

const theme = loadDefaultTheme();
const report = validateProject("./app", { stack: "css-vars" });
console.log(report.score, report.findings);
```

## Demo

```bash
dsmcp demo --out ./demo
npx serve ./demo        # or any static server, then open the printed URL
```

The page renders every token and governed component across **all 18 modes × all
6 typefaces**, with two independent live switchers. It is generated on demand —
it is **not** part of the published npm package and is not hosted anywhere by
default. (Want it live on GitHub Pages? See [RELEASE.md](RELEASE.md).)

## Develop

```bash
npm install
npm test     # build + MCP stdio smoke (11 tools) + scaffold/typeface + validator + importer
```

The compiled CLI is `node dist/cli.js <cmd>` (same commands as `dsmcp <cmd>`).

```
src/engine/    pure core (tokens, resolver, rules, contract) — no MCP/CLI deps
src/mcp/       MCP stdio façade
src/cli.ts     CLI façade
themes/default DTCG default theme + typefaces.json
test/          smoke harnesses + good-vs-drifted fixtures
```

## Docs

- **[PLAN.md](PLAN.md)** — full design, architecture, and delivery status (§0).
- **[RELEASE.md](RELEASE.md)** — how to publish (manual + tag-driven CI).

## License

[MIT](LICENSE)
