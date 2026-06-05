# Design System Governance (dsmcp)

This project is governed by **dsmcp**. Every session:

1. Call `get_contract({ stack: "flutter" })` BEFORE writing any UI code.
2. Use ONLY approved tokens (`list_tokens`, `resolve_token`). NEVER hardcode Color(0x…) or Colors.<name>; use Theme.of(context).colorScheme.* (the themed token).
3. For any component, call `get_component_spec` and copy the governed blueprint.
4. Every interactive element MUST define its states (hover / active / focus-visible /
   disabled) in EVERY mode. Declared modes: light, dark, high-contrast-dark (default: light).
5. Switch modes via ThemeController.setMode("<mode>") (Map<String, ThemeData> appThemes).
6. Before finishing, run `npx --yes dsmcp validate .` and fix every `error`.
