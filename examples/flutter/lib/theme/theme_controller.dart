import 'package:flutter/material.dart';
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
