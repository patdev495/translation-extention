# Design: PolyTranslate

Shared visual system for the extension's app screens.

## System

- Genre: modern-minimal.
- Shape: app screen.
- Theme: Coral, dealt 3/3. Warm light paper, dark ink, restrained coral.
- Audience: people reading and translating English, Vietnamese and Chinese.
- Signature: a clear multilingual reading sheet with pronunciation beside the source.
- Preserve the PolyTranslate name, settings, routes, actions and underlying behavior.

## Tokens

The source of truth is `src/ui/tokens.css`, shared by documents and Shadow DOM.
Paper is oklch(97% 0.006 55), ink is oklch(21% 0.012 38).
Coral oklch(54% 0.165 29) marks selected controls, state and focus.
Use the body face for all labels; sentence case without tracking.
System sans is intentional for offline availability and multilingual fallback.
Use one radius per level, flat sections, rules and tinted surfaces.
No ornamental gradients, glass, glows, texture or photo placeholders in these tools.

## Controls

- Native inputs and selects, 36px visual height with 44px interaction rows.
- Icon actions have 44px hit areas, compact glyphs and clear accessible names.
- Focus uses an immediate 2px outline in the focus token.
- Disabled controls use the native attribute, opacity and the unavailable cursor.
- Primary action: ink fill, paper text. Secondary actions: paper or text.
- Switches: coral on, neutral off, with a visible native checkbox focus ring.

## Motion

Still by default. Only short state transitions; reduced motion removes animation.
No entrance choreography on settings or reading tools.

## Exports

`src/ui/tokens.css` and `src/ui/base.css`.
Document styles import them; isolated UI imports CSS inline through Vite.

## Variants

The Translation Tooltip uses a darker warm-grey surface (91% lightness),
a visible perimeter, stronger separators and darker secondary text/icons.
Dedicated `--color-tooltip-*` tokens keep this contrast treatment local to
the tooltip; the popup, PDF viewer and other panels retain their light surfaces.
