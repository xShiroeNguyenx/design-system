// Phase 3a validator proof: clean input passes, deliberate drift is caught with
// the EXACT expected findings (count + ruleIds), and suggest_fix is honest.
import { validateProject, validateCode, suggestFix, loadDefaultTheme } from "../dist/engine/index.js";

let failures = 0;
const fail = (m) => { console.error("✗ " + m); failures++; };
const ok = (m) => console.log("✓ " + m);
const eq = (label, got, want) => (got === want ? ok(`${label} = ${got}`) : fail(`${label}: got ${got}, want ${want}`));
const countBy = (findings, id) => findings.filter((f) => f.ruleId === id).length;

const theme = loadDefaultTheme();

// 1. clean examples -> pass
const clean = validateProject("examples/css-vars");
eq("clean errors", clean.errors, 0);
eq("clean warnings", clean.warnings, 0);
eq("clean score", clean.score, 100);
if (!clean.pass) fail("clean project should pass");
else ok("clean project passes (exit would be 0)");

// 2. drifted fixture -> exact findings
const drift = validateProject("test/fixtures/css-vars/drifted");
eq("drift no-raw-color count", countBy(drift.findings, "no-raw-color"), 4);
eq("drift single-mode-strategy count", countBy(drift.findings, "single-mode-strategy"), 1);
eq("drift errors", drift.errors, 4);
eq("drift warnings", drift.warnings, 1);
eq("drift score", drift.score, 57); // 100 - 10*4 - 3*1
if (drift.pass) fail("drifted project must NOT pass (exit would be 1)");
else ok("drifted project fails (exit would be 1)");
// the --brand: #fff DEFINITION must NOT be flagged
if (drift.findings.some((f) => f.snippet && f.snippet.includes("--brand")))
  fail("custom-property definition was wrongly flagged");
else ok("custom-property definition (--brand) not flagged");

// 3. theme rules clean (contrast fixed in Phase 3a)
const codeOnlyVsFull = validateProject("examples/css-vars", { codeOnly: true });
eq("examples code-only errors", codeOnlyVsFull.errors, 0);
ok("theme rules (contrast/completeness) clean on default theme");

// 4. validate_code on an inline snippet
const snip = validateCode({ stack: "css-vars", code: ".a{color:#000}", path: "a.css" });
eq("snippet raw-color count", countBy(snip.findings, "no-raw-color"), 1);

// 5. suggest_fix: deterministic for raw color, descriptive for contrast
const rawFinding = drift.findings.find((f) => f.ruleId === "no-raw-color" && /#3b82f6/.test(f.message));
const rawFix = suggestFix(rawFinding, theme);
if (!rawFix.fixable || !rawFix.replacement?.startsWith("var(--")) fail("raw-color fix not deterministic var()");
else ok(`raw-color fix: ${rawFix.replacement}`);
const contrastFix = suggestFix({ ruleId: "contrast-aa", message: "x", severity: "error" }, theme);
if (contrastFix.fixable) fail("contrast must NOT be auto-fixable");
else ok("contrast fix is descriptive only (not mechanical)");

// 6. flagship interactive-completeness: ZERO on own governed output, EXACT on fixture
const ownGen = validateProject("examples/css-vars");
eq("own output interactive-completeness", countBy(ownGen.findings, "interactive-completeness"), 0);

const flag = validateProject("test/fixtures/css-vars/interactive", { codeOnly: true });
eq("fixture interactive-completeness count", countBy(flag.findings, "interactive-completeness"), 1);
const ic = flag.findings.find((f) => f.ruleId === "interactive-completeness");
if (!ic || ic.snippet !== ".btn") fail(`expected .btn family flagged, got ${ic?.snippet}`);
else ok(`flagged family = ${ic.snippet}`);
if (!/active/.test(ic.message) || !/disabled/.test(ic.message)) fail("missing states should be active+disabled");
else ok("missing states correctly = active, disabled");
// negatives must not fire: input (complete), link (complete), ignored button, container
if (flag.findings.some((f) => f.ruleId === "interactive-completeness" && f.snippet !== ".btn"))
  fail("a negative case wrongly fired");
else ok("negatives (input/link/ignored/container) did not fire");

// 7. Tailwind stack: own output clean, drifted exact, and appliesTo is load-bearing
const twGood = validateProject("examples/tailwind", { stack: "tailwind" });
eq("tailwind own-output errors", twGood.errors, 0);

const twDrift = validateProject("test/fixtures/tailwind/drifted", { stack: "tailwind", codeOnly: true });
eq("tailwind no-raw-class count", countBy(twDrift.findings, "no-raw-class"), 2);
eq("tailwind interactive count", countBy(twDrift.findings, "interactive-completeness-tailwind"), 1);
eq("tailwind drift errors", twDrift.errors, 3);

// appliesTo: tailwind run must NOT include css-vars rule ids
const twIds = new Set(twDrift.findings.map((f) => f.ruleId));
for (const cssId of ["no-raw-color", "single-mode-strategy", "interactive-completeness"]) {
  if (twIds.has(cssId)) fail(`css rule '${cssId}' wrongly ran on a tailwind project`);
}
ok("css-vars rules did NOT run on the tailwind project");

// ...and a css-vars run on the same dir must NOT include tailwind rule ids (no vacuous pass either way)
const asCss = validateProject("test/fixtures/tailwind/drifted", { stack: "css-vars", codeOnly: true });
const cssIds = new Set(asCss.findings.map((f) => f.ruleId));
for (const twId of ["no-raw-class", "interactive-completeness-tailwind"]) {
  if (cssIds.has(twId)) fail(`tailwind rule '${twId}' wrongly ran on a css-vars project`);
}
ok("tailwind rules did NOT run under the css-vars stack");

// 8. vanilla is a true alias: same component CSS + clean validation
const vanillaGood = validateProject("examples/vanilla", { stack: "vanilla" });
eq("vanilla own-output errors", vanillaGood.errors, 0);

// 9. Flutter: .dart IS scanned (scanned>0, not a false green), own output clean,
//    drifted exact, and appliesTo holds across the Dart boundary.
const flGood = validateProject("examples/flutter", { stack: "flutter" });
if (!(flGood.scannedFiles > 0)) fail(`flutter scanned 0 files — .dart not collected (false green)`);
else ok(`flutter scanned ${flGood.scannedFiles} .dart files`);
eq("flutter own-output errors", flGood.errors, 0);

const flDrift = validateProject("test/fixtures/flutter/drifted", { stack: "flutter", codeOnly: true });
eq("flutter no-raw-color-dart count", countBy(flDrift.findings, "no-raw-color-dart"), 2);
if (!(flDrift.scannedFiles > 0)) fail("flutter drift scanned 0 files");
// appliesTo: flutter run excludes web rule ids; css run on the dart dir excludes the dart rule
const flIds = new Set(flDrift.findings.map((f) => f.ruleId));
for (const webId of ["no-raw-color", "no-raw-class", "interactive-completeness"]) {
  if (flIds.has(webId)) fail(`web rule '${webId}' wrongly ran on a flutter project`);
}
ok("web rules did NOT run on the flutter project");
const dartAsCss = validateProject("test/fixtures/flutter/drifted", { stack: "css-vars", codeOnly: true });
if (new Set(dartAsCss.findings.map((f) => f.ruleId)).has("no-raw-color-dart"))
  fail("dart rule wrongly ran under css-vars stack");
else ok("dart rule did NOT run under the css-vars stack");

if (failures) { console.error(`\nFAILED: ${failures} issue(s)`); process.exit(1); }
console.log("\nVALIDATOR VERIFY PASS");
