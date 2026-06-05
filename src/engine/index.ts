/**
 * dsmcp engine — public API (transport-agnostic core).
 *
 * The MCP server (`mcp/server.ts`), CLI (`cli.ts`) and hooks all import from
 * here. NOTHING under `engine/` may import `@modelcontextprotocol/sdk`.
 */

export * from "./tokens/types.js";
export * from "./tokens/resolver.js";
export * from "./tokens/query.js";
export { loadDefaultTheme } from "./tokens/loader.js";
export * from "./contract/builder.js";
export * from "./components/types.js";
export * from "./components/specs.js";
export { cssVarName, cssVarRef, toCssValue } from "./adapters/css-vars/naming.js";
export {
  emitCssVars,
  emitComponentCss,
  emitTypeThemeCss,
  googleFontsLinks,
  referencedVarNames,
  definedVarNames,
} from "./adapters/css-vars/emit.js";
export * from "./util/files.js";
export * from "./scaffold/scaffold.js";
export * from "./scaffold/demo.js";
export * from "./rules/types.js";
export * from "./rules/defs.js";
export * from "./rules/contrast.js";
export { checkInteractiveCompleteness } from "./rules/interactive.js";
export * from "./rules/engine.js";
export { suggestFix } from "./rules/fix.js";
export type { SuggestFixResult } from "./rules/fix.js";
export * from "./importers/index.js";
