// Deliberately drifted Flutter widget — the validator MUST flag hardcoded colors.
// This is a widget file (unmarked), so Color(0x..) is treated as USAGE.
import 'package:flutter/material.dart';

class BadButton extends StatelessWidget {
  const BadButton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFFF0000), // VIOLATION: hardcoded Color(0x..)
      child: Text(
        'Hi',
        style: TextStyle(color: Colors.white), // VIOLATION: Colors.<name> palette
      ),
    );
  }
}

class GoodButton extends StatelessWidget {
  const GoodButton({super.key});

  @override
  Widget build(BuildContext context) {
    // OK: pulls from the themed ColorScheme, no hardcoded colors.
    final scheme = Theme.of(context).colorScheme;
    return Container(color: scheme.primary, child: Text('Hi', style: TextStyle(color: scheme.onPrimary)));
  }
}
