// MCP stdio round-trip against dist/mcp/server.js: exercises every tool through
// the actual MCP handler path (not just the engine). Exits non-zero on failure.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/mcp/server.js"],
});

const client = new Client({ name: "smoke", version: "0" });
await client.connect(transport);

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name);
console.log("tools/list:", names.join(", "));
if (!names.includes("get_contract")) throw new Error("get_contract not advertised");

const res = await client.callTool({
  name: "get_contract",
  arguments: { stack: "css-vars" },
});
const text = res.content.find((c) => c.type === "text")?.text ?? "";
if (!text.includes("Theme Governance Contract")) {
  throw new Error("get_contract returned unexpected content");
}
const json = JSON.parse(res.content[1].text);
console.log(
  `get_contract OK — stack=${json.stack}, modes=[${json.modes}], categories=${Object.keys(json.tokensByCategory).length}, components=[${json.components}], rules=${json.rules.length}`
);

// list_tokens (color category)
const lt = await client.callTool({ name: "list_tokens", arguments: { category: "color" } });
const tokens = JSON.parse(lt.content[0].text);
if (!Array.isArray(tokens) || tokens.length === 0) throw new Error("list_tokens empty");
console.log(`list_tokens OK — ${tokens.length} color tokens`);

// resolve_token in dark mode
const rt = await client.callTool({
  name: "resolve_token",
  arguments: { name: "button.primary.bg", mode: "dark" },
});
const rtj = JSON.parse(rt.content[0].text);
if (!rtj.ok) throw new Error("resolve_token failed: " + rtj.error);
console.log(`resolve_token OK — button.primary.bg@dark = ${rtj.value}`);

// get_component_spec (button / css-vars)
const cs = await client.callTool({
  name: "get_component_spec",
  arguments: { name: "button", stack: "css-vars" },
});
const csj = JSON.parse(cs.content[0].text);
if (!csj.ok || !csj.stackSupported || !csj.spec.code["css-vars"].includes(".btn"))
  throw new Error("get_component_spec failed");
console.log(`get_component_spec OK — button states=[${csj.spec.states}]`);

// scaffold_theme through the MCP handler's outDir write branch
const scDir = mkdtempSync(join(tmpdir(), "dsmcp-scaffold-"));
const sc = await client.callTool({
  name: "scaffold_theme",
  arguments: { stack: "css-vars", outDir: scDir },
});
const scj = JSON.parse(sc.content[0].text);
if (!scj.written?.includes("theme/tokens.css")) throw new Error("scaffold_theme did not write tokens.css");
if (!existsSync(join(scDir, "theme/tokens.css"))) throw new Error("scaffold_theme file missing on disk");
console.log(`scaffold_theme OK — wrote ${scj.written.length} files (switcher=${scj.switcherKind})`);

// generate_demo through the MCP handler's outDir write branch
const dmDir = mkdtempSync(join(tmpdir(), "dsmcp-demo-"));
const dm = await client.callTool({
  name: "generate_demo",
  arguments: { stack: "css-vars", outDir: dmDir },
});
const dmj = JSON.parse(dm.content[0].text);
if (!existsSync(join(dmDir, "index.html"))) throw new Error("generate_demo did not write index.html");
console.log(`generate_demo OK — wrote ${dmj.written.length} files (modes=[${dmj.modes}])`);

// validate_code (inline snippet with a raw color)
const vc = await client.callTool({
  name: "validate_code",
  arguments: { stack: "css-vars", code: ".a{color:#000}", path: "a.css" },
});
const vcj = JSON.parse(vc.content[0].text);
if (vcj.errors !== 1) throw new Error("validate_code expected 1 error, got " + vcj.errors);
console.log(`validate_code OK — ${vcj.errors} error, score ${vcj.score}`);

// validate_project on the clean scaffold we just wrote
const vp = await client.callTool({ name: "validate_project", arguments: { dir: scDir } });
const vpj = JSON.parse(vp.content[0].text);
if (!vpj.pass) throw new Error("validate_project: scaffold should pass, got score " + vpj.score);
console.log(`validate_project OK — clean scaffold passes (score ${vpj.score})`);

// suggest_fix for a raw-color finding
const sf = await client.callTool({
  name: "suggest_fix",
  arguments: { finding: { ruleId: "no-raw-color", severity: "error", message: "Raw color '#3b82f6' in 'color'." } },
});
const sfj = JSON.parse(sf.content[0].text);
if (!sfj.fixable || !sfj.replacement?.startsWith("var(--")) throw new Error("suggest_fix not deterministic");
console.log(`suggest_fix OK — ${sfj.replacement}`);

// import_theme (css) — reports gaps, doesn't throw
const it = await client.callTool({
  name: "import_theme",
  arguments: { format: "css", source: ":root{--color-bg-default:#fff;--color-text-primary:#111}" },
});
const itj = JSON.parse(it.content[0].text);
if (!Array.isArray(itj.gaps) || itj.theme.modes.length !== 1) throw new Error("import_theme bad result");
console.log(`import_theme OK — modes=${itj.theme.modes.length}, gaps=${itj.gaps.length}`);

// register_theme — validate a tiny DTCG theme
const rg = await client.callTool({
  name: "register_theme",
  arguments: {
    definition: {
      name: "tiny",
      modes: [{ name: "light" }],
      defaultMode: "light",
      tokens: { color: { bg: { default: { $value: "#ffffff" } } } },
    },
  },
});
const rgj = JSON.parse(rg.content[0].text);
if (typeof rgj.accepted !== "boolean") throw new Error("register_theme bad result");
console.log(`register_theme OK — accepted=${rgj.accepted}`);

await client.close();
console.log("SMOKE PASS");
