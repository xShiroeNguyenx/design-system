// Phase 4b importer proof: emit->import round-trip is clean; gaps are REPORTED
// (not thrown) for single-mode CSS and a one-palette tailwind.config.
import { readFileSync } from "node:fs";
import { importTheme, registerTheme, loadDefaultTheme } from "../dist/engine/index.js";

let failures = 0;
const fail = (m) => { console.error("✗ " + m); failures++; };
const ok = (m) => console.log("✓ " + m);
const eq = (l, g, w) => (g === w ? ok(`${l} = ${g}`) : fail(`${l}: got ${g}, want ${w}`));

// 1. round-trip: import the css-vars tokens.css we generated -> clean, 18 modes
const tokensCss = readFileSync("examples/css-vars/theme/tokens.css", "utf8");
const rt = importTheme({ format: "css", source: tokensCss, name: "roundtrip" });
eq("round-trip modes", rt.theme.modes.length, 18);
eq("round-trip errors", rt.report.errors, 0);
if (rt.gaps.some((g) => /mode/.test(g) && /Only/.test(g))) fail("round-trip wrongly reported a mode gap");
else ok("round-trip: no mode gap (18 modes reconstructed)");

// 2. single-mode CSS -> import succeeds and REPORTS the missing-dark gap
const single = importTheme({ format: "css", source: readFileSync("test/fixtures/import/single-mode.css", "utf8") });
eq("single-mode modes", single.theme.modes.length, 1);
if (!single.gaps.some((g) => /no dark mode|Only 1 mode/.test(g))) fail("single-mode gap not reported");
else ok("single-mode gap reported: " + single.gaps.find((g) => /mode/.test(g)));

// 3. tailwind.config -> DTCG primitives + gap report (one palette, single mode)
const twConfig = JSON.parse(readFileSync("test/fixtures/import/tailwind.config.json", "utf8"));
const tw = importTheme({ format: "tailwind", config: twConfig, name: "tw" });
const flat = JSON.stringify(tw.theme.tokens);
if (!/"blue"/.test(flat) || !/"500"/.test(flat)) fail("tailwind import missing color.blue.500");
else ok("tailwind import produced color.blue.500");
if (!/"brand"/.test(flat)) fail("tailwind import missing color.brand");
else ok("tailwind import produced color.brand");
// DEFAULT collapses onto the parent (surface.DEFAULT -> color.surface)
if (!tw.theme.tokens.color?.surface?.$value) fail("tailwind DEFAULT did not collapse onto color.surface");
else ok("tailwind DEFAULT collapsed -> color.surface");
eq("tailwind modes", tw.theme.modes.length, 1);
if (!tw.gaps.some((g) => /mode/.test(g))) fail("tailwind gap not reported");
else ok("tailwind gap reported");

// 4. register_theme on the bundled default theme -> accepted (0 errors)
const reg = registerTheme(loadDefaultTheme());
if (!reg.accepted) fail("default theme should be accepted by register_theme");
else ok(`register_theme accepted default theme (score ${reg.report.score})`);

if (failures) { console.error(`\nFAILED: ${failures} issue(s)`); process.exit(1); }
console.log("\nIMPORTER VERIFY PASS");
