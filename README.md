# dsmcp — Theme Governance MCP

[![npm version](https://img.shields.io/npm/v/@shiroe_nguyen/dsmcp.svg)](https://www.npmjs.com/package/@shiroe_nguyen/dsmcp)
[![license](https://img.shields.io/npm/l/@shiroe_nguyen/dsmcp.svg)](LICENSE)
[![node](https://img.shields.io/node/v/@shiroe_nguyen/dsmcp.svg)](package.json)
[![live demo](https://img.shields.io/badge/live%20demo-online-brightgreen)](https://xshiroenguyenx.github.io/design-system/)

🔗 **[Live demo](https://xshiroenguyenx.github.io/design-system/)** — every token & component across all 18 modes × 6 typefaces, with two live switchers.

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
npm install -g @shiroe_nguyen/dsmcp   # puts `dsmcp` + `dsmcp-mcp` on your PATH
# or run without installing:
npx @shiroe_nguyen/dsmcp doctor
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

The package ships a `dsmcp-mcp` stdio server. Register it with Claude Code /
Cursor / Claude Desktop. **In `.mcp.json` the args are passed literally (no
shell), so the scoped name needs no quoting — copy as-is:**

**macOS / Linux:**

```json
{
  "mcpServers": {
    "dsmcp": { "command": "npx", "args": ["-y", "-p", "@shiroe_nguyen/dsmcp", "dsmcp-mcp"] }
  }
}
```

**Windows** (wrap with `cmd /c` — clients can't always spawn `npx.cmd` directly):

```json
{
  "mcpServers": {
    "dsmcp": { "command": "cmd", "args": ["/c", "npx", "-y", "-p", "@shiroe_nguyen/dsmcp", "dsmcp-mcp"] }
  }
}
```

> **Testing in a terminal?** Quote the scoped name — PowerShell otherwise reads
> `@…` as splatting and drops the package:
> `npx -y -p "@shiroe_nguyen/dsmcp" dsmcp doctor`

**11 tools**: `get_contract`, `list_tokens`, `resolve_token`,
`get_component_spec`, `scaffold_theme`, `generate_demo`, `validate_code`,
`validate_project`, `suggest_fix`, `import_theme`, `register_theme`.

## Use as a library

```js
import { loadDefaultTheme, scaffoldTheme, validateProject } from "@shiroe_nguyen/dsmcp";

const theme = loadDefaultTheme();
const report = validateProject("./app", { stack: "css-vars" });
console.log(report.score, report.findings);
```

## Demo

**▶ Live: https://xshiroenguyenx.github.io/design-system/**

The page renders every token and governed component across **all 18 modes × 6
typefaces**, with two independent live switchers. It is auto-deployed to GitHub
Pages on every push to `main` (see [`.github/workflows/demo.yml`](.github/workflows/demo.yml)).

Generate it yourself anytime:

```bash
dsmcp demo --out ./demo
npx serve ./demo        # or any static server, then open the printed URL
```

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
