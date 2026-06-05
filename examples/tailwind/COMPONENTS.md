# Governed components (Tailwind)

Copy these class strings — they use semantic preset utilities only.

## button

```html
<!-- Governed Tailwind button — copy the class strings. Variants cover every mode
     via the data-theme preset (theme/tokens.css). Use semantic utilities only. -->
<button class="inline-flex items-center gap-2 px-4 py-2 rounded-control font-semibold
  bg-action-primary-bg text-action-primary-fg
  hover:bg-action-primary-hover active:bg-action-primary-active
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-action-primary-focus
  disabled:bg-action-primary-disabled disabled:text-text-muted disabled:cursor-not-allowed">Primary</button>

<button class="inline-flex items-center gap-2 px-4 py-2 rounded-control font-semibold
  bg-action-secondary-bg text-action-secondary-fg
  hover:bg-action-secondary-hover active:bg-action-secondary-active
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-action-secondary-focus
  disabled:bg-action-secondary-disabled disabled:text-text-muted disabled:cursor-not-allowed">Secondary</button>

<button class="inline-flex items-center gap-2 px-4 py-2 rounded-control font-semibold
  bg-action-danger-bg text-action-danger-fg
  hover:bg-action-danger-hover active:bg-action-danger-active
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-action-danger-focus
  disabled:bg-action-danger-disabled disabled:text-text-muted disabled:cursor-not-allowed">Danger</button>
```
## input

```html
<!-- Governed Tailwind input — semantic utilities, full state matrix. -->
<input class="w-full px-3 py-2 rounded-control bg-bg-raised text-text-primary border border-border-default
  placeholder:text-text-muted hover:border-text-muted
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-action-primary-focus
  disabled:bg-bg-subtle disabled:text-text-muted disabled:cursor-not-allowed" />
```
## card

```html
<!-- Governed Tailwind card (non-interactive). -->
<div class="bg-bg-raised text-text-primary border border-border-default rounded-surface shadow-card p-6">…</div>
```
