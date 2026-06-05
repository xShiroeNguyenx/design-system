// Phase 2 coherence check (no browser): proves the scaffold is internally sound.
//  1. every var(--x) referenced by component CSS is DEFINED in EVERY mode block,
//  2. scaffold of the default theme (18 modes) yields the dropdown switcher,
//  3. scaffold at 2 modes yields the toggle switcher,
//  4. generated theme/app CSS contains no raw hex colors (validator-ready).
import {
  loadDefaultTheme,
  scaffoldTheme,
  generateDemo,
  emitComponentCss,
  referencedVarNames,
  definedVarNames,
} from "../dist/engine/index.js";

let failures = 0;
const fail = (msg) => { console.error("✗ " + msg); failures++; };
const ok = (msg) => console.log("✓ " + msg);

const theme = loadDefaultTheme();
const allModes = theme.modes.map((m) => m.name);

// 1. var-coverage across every mode
const componentCss = emitComponentCss("css-vars");
const refs = referencedVarNames(componentCss);
ok(`component CSS references ${refs.size} vars`);
for (const mode of allModes) {
  const defined = definedVarNames(theme, mode);
  const missing = [...refs].filter((r) => !defined.has(r));
  if (missing.length) fail(`mode '${mode}' missing vars: ${missing.join(", ")}`);
  else ok(`mode '${mode}' defines all ${refs.size} referenced vars`);
}

// 2. N-mode switcher (default theme ships 18 modes -> dropdown)
const s3 = scaffoldTheme(theme, { stack: "css-vars" });
if (s3.modes.length !== 18) fail(`expected 18 modes (full catalog), got ${s3.modes.length}`);
if (s3.switcherKind !== "dropdown") fail(`>2 modes should be dropdown, got ${s3.switcherKind}`);
else ok(`${s3.modes.length} modes -> dropdown switcher`);
const switcherJs = s3.files.find((f) => f.path === "theme/theme.js").content;
if (!switcherJs.includes("createElement(\"select\")")) fail("dropdown JS missing <select>");
else ok("dropdown switcher renders <select>");

// 3. 2-mode toggle
const s2 = scaffoldTheme(theme, { stack: "css-vars", modes: ["light", "dark"] });
if (s2.switcherKind !== "toggle") fail(`2 modes should be toggle, got ${s2.switcherKind}`);
else ok("2 modes -> toggle switcher");

// 4. no raw hex in generated theme/app CSS (vars only)
const tokensCss = s3.files.find((f) => f.path === "theme/tokens.css").content;
const appCss = s3.files.find((f) => f.path === "index.html").content;
const hexInComponents = /#[0-9a-fA-F]{3,8}\b/.test(componentCss);
const hexInApp = /#[0-9a-fA-F]{3,8}\b/.test(appCss);
if (hexInComponents) fail("component CSS contains raw hex");
else ok("component CSS has no raw hex");
if (hexInApp) fail("starter index.html contains raw hex");
else ok("starter index.html has no raw hex");
// tokens.css legitimately contains hex (it's the value source) — assert it does.
if (!/#[0-9a-fA-F]{6}\b/.test(tokensCss)) fail("tokens.css unexpectedly has no color values");
else ok("tokens.css carries the literal color values (as expected)");

// 5. enforcement scripts guard against the Phase-3 stub (exit 2)
const preCommit = s3.files.find((f) => f.path === ".husky/pre-commit").content;
if (!preCommit.includes('"$code" = "2"')) fail("pre-commit missing Phase-3 exit-2 guard");
else ok("pre-commit guards the Phase-3 validate stub");

// 6. demo golden fixture: no hardcoded colors/dims in HTML or demo.css, and
//    every var it references is defined in every mode.
const demo = generateDemo(theme, { stack: "css-vars" });
const demoHtml = demo.files.find((f) => f.path === "index.html").content;
const demoCss = demo.files.find((f) => f.path === "demo.css").content;
if (/#[0-9a-fA-F]{3,8}\b/.test(demoHtml)) fail("demo index.html contains raw hex");
else ok("demo index.html has no raw hex");
if (/#[0-9a-fA-F]{3,8}\b/.test(demoCss)) fail("demo.css contains raw hex");
else ok("demo.css has no raw hex");
const demoRefs = new Set([...referencedVarNames(demoHtml), ...referencedVarNames(demoCss)]);
for (const mode of allModes) {
  const defined = definedVarNames(theme, mode);
  const missing = [...demoRefs].filter((r) => !defined.has(r));
  if (missing.length) fail(`demo: mode '${mode}' missing vars: ${missing.join(", ")}`);
}
ok(`demo references ${demoRefs.size} vars, all defined in every mode`);
if (!demoHtml.includes('data-theme="high-contrast-dark"')) fail("demo side-by-side missing 3rd mode panel");
else ok("demo renders all modes side-by-side (incl. high-contrast-dark)");

// 6b. Typeface axis (font-packs): independent [data-type] blocks, emitted AFTER
//     the mode blocks (source-order is what makes font vars win when an element
//     carries both data-theme + data-type), + the second switcher is wired.
const lastModeAt = tokensCss.lastIndexOf("[data-theme=");
const firstTypeAt = tokensCss.indexOf("[data-type=");
if (firstTypeAt < 0) fail("tokens.css has no [data-type] type-theme blocks");
else if (firstTypeAt < lastModeAt) fail("[data-type] block emitted before a [data-theme] block — font vars would lose the source-order tie");
else ok("type-theme [data-type] blocks emitted after all mode blocks (font vars win)");
if (!switcherJs.includes("dsmcp-type-switcher")) fail("theme.js does not mount the typeface switcher");
else ok("theme.js mounts the typeface switcher (#dsmcp-type-switcher)");
if (!appCss.includes('id="dsmcp-type-switcher"')) fail("starter index.html missing the type switcher slot");
else ok("starter index.html has the type switcher slot");
if (!/fonts\.googleapis\.com/.test(appCss)) fail("starter index.html missing the Google Fonts link");
else ok("starter index.html links Google Fonts for the type-packs");
if (!/data-type="serif"/.test(demoHtml)) fail("demo missing the Typefaces specimen section");
else ok("demo renders the Typefaces specimen section");

// 7. Flutter scaffold: Dart files only (no web tokens.css/theme.js), N-mode map,
//    generated marker present, ARGB colors.
const fl = scaffoldTheme(theme, { stack: "flutter" });
const flPaths = fl.files.map((f) => f.path);
if (flPaths.some((p) => p.endsWith("tokens.css") || p.endsWith("theme.js")))
  fail("flutter scaffold wrongly emitted web files (tokens.css/theme.js)");
else ok("flutter scaffold emitted no web CSS/JS files");
const appTheme = fl.files.find((f) => f.path === "lib/theme/app_theme.dart").content;
if (!/^\s*\/\/\s*dsmcp:generated/m.test(appTheme)) fail("app_theme.dart missing dsmcp:generated marker");
else ok("app_theme.dart carries the dsmcp:generated marker");
const modeEntries = (appTheme.match(/ThemeData\(/g) || []).length;
if (modeEntries !== 18) fail(`expected 18 ThemeData entries (full N-mode catalog), got ${modeEntries}`);
else ok(`flutter app_theme has ${modeEntries} ThemeData entries (one per mode)`);
if (!/Color\(0xFF[0-9A-F]{6}\)/.test(appTheme)) fail("app_theme.dart missing ARGB Color(0xFF…) literals");
else ok("flutter colors emitted as ARGB Color(0xFF…)");

if (failures) { console.error(`\nFAILED: ${failures} issue(s)`); process.exit(1); }
console.log("\nVERIFY PASS");
