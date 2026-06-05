/**
 * Flutter adapter (PLAN §8, stack flutter). A different engine: no CSS vars / no
 * data-theme. Emits an N-mode `Map<String, ThemeData>` (ThemeMode only covers
 * light/dark/system, so it can't express >2 modes) + a ChangeNotifier controller.
 *
 * The generated theme file carries `// dsmcp:generated` so its `Color(0x..)`
 * literals are accepted by the no-raw-color-dart rule (definition site).
 *
 * NOTE: generated Dart is structurally emitted but NOT compile-verified here
 * (no Dart toolchain in this environment).
 */

import { ModeName, ThemeDefinition } from "../../tokens/types.js";
import { createContext, resolveToken } from "../../tokens/resolver.js";

/** CSS hex (#rgb/#rrggbb/#rrggbbaa) -> Dart `Color(0xAARRGGBB)`. */
export function hexToDartColor(input: string): string {
  const s = input.trim().replace(/^#/, "");
  let rrggbb: string;
  let aa = "FF";
  if (s.length === 3) {
    rrggbb = s.split("").map((c) => c + c).join("");
  } else if (s.length === 6) {
    rrggbb = s;
  } else if (s.length === 8) {
    rrggbb = s.slice(0, 6);
    aa = s.slice(6, 8); // CSS #RRGGBBAA -> Dart alpha moves to front
  } else {
    throw new Error(`Cannot convert '${input}' to a Dart Color`);
  }
  return `Color(0x${(aa + rrggbb).toUpperCase()})`;
}

/** Dart-safe identifier from a mode name (high-contrast-dark -> high_contrast_dark). */
function ident(mode: ModeName): string {
  return mode.replace(/[^a-zA-Z0-9]/g, "_");
}

const ROLES: Array<[dartParam: string, tokenPath: string]> = [
  ["primary", "color.action.primary.bg"],
  ["onPrimary", "color.action.primary.fg"],
  ["secondary", "color.action.secondary.bg"],
  ["onSecondary", "color.action.secondary.fg"],
  ["error", "color.action.danger.bg"],
  ["onError", "color.action.danger.fg"],
  ["surface", "color.bg.raised"],
  ["onSurface", "color.text.primary"],
  ["outline", "color.border.default"],
];

/** Emit the generated ThemeData map (lib/theme/app_theme.dart). */
export function emitFlutterTheme(theme: ThemeDefinition, modes: ModeName[], defaultMode: ModeName): string {
  const ctx = createContext(theme);
  const schemes = modes
    .map((mode) => {
      const brightness = /dark/i.test(mode) ? "Brightness.dark" : "Brightness.light";
      const lines = ROLES.map(([param, path]) => {
        const hex = String(resolveToken(path, mode, ctx));
        return `      ${param}: ${hexToDartColor(hex)},`;
      }).join("\n");
      return `ColorScheme _scheme_${ident(mode)}() => const ColorScheme(\n      brightness: ${brightness},\n${lines}\n    );`;
    })
    .join("\n\n");

  const entries = modes
    .map((mode) => `  '${mode}': ThemeData(useMaterial3: true, colorScheme: _scheme_${ident(mode)}()),`)
    .join("\n");

  return `// dsmcp:generated — Color() literals are allowed in this theme source. DO NOT EDIT BY HAND.
import 'package:flutter/material.dart';

const List<String> appModes = ${JSON.stringify(modes)};
const String defaultMode = '${defaultMode}';

${schemes}

final Map<String, ThemeData> appThemes = {
${entries}
};
`;
}

/** Emit the N-mode controller (lib/theme/theme_controller.dart). */
export function emitFlutterController(): string {
  return `import 'package:flutter/material.dart';
import 'app_theme.dart';

/// Holds the active mode (any of appModes) and exposes its ThemeData.
/// N-mode: not limited to ThemeMode.light/dark — keyed by mode name.
class ThemeController extends ChangeNotifier {
  String _mode = defaultMode;
  String get mode => _mode;
  List<String> get modes => appModes;
  ThemeData get theme => appThemes[_mode] ?? appThemes[defaultMode]!;

  void setMode(String next) {
    if (appThemes.containsKey(next) && next != _mode) {
      _mode = next;
      notifyListeners();
    }
  }
}
`;
}
