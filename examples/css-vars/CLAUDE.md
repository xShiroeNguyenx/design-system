# Design System Governance (dsmcp)

This project is governed by **dsmcp**. Every session:

1. Call `get_contract({ stack: "css-vars" })` BEFORE writing any UI code.
2. Use ONLY approved tokens (`list_tokens`, `resolve_token`). NEVER hardcode
   colors (hex/rgb/hsl) or raw spacing/radius/shadow when a token exists.
3. For any component, call `get_component_spec` and copy the governed blueprint.
4. Every interactive element MUST define hover / active / focus-visible /
   disabled in EVERY mode. Declared modes: light, dark, high-contrast-dark (default: light).
5. Use a single mode strategy: `data-theme="<mode>"`.
6. Before finishing, run `npx --yes dsmcp validate .` and fix every `error`.
