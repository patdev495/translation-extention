# Implementation plan: Hanzi Component Breakdown

This plan implements the accepted PRD in vertical TDD slices. The user confirmed the public test seams before implementation.

## Result

- Implemented the packaged Make Me a Hanzi dictionary, settings, independent breakdown card, component navigation, bilingual explanations, on-demand Vietnamese translation, and cache.
- The full repository suite passed with 26 files and 94 tests before the final partial-decomposition test was added; that additional focused test also passed.
- `npm run build` passed and produced 9,574 dictionary records, the pinned raw source, and its LGPL/COPYING/provenance files.

## Public test seams

1. **Settings popup and persisted settings**: interact with the real popup controls, then read settings through `SettingsManager.getSettings()`. Cover the default-off breakdown toggle, Vietnamese default language, and updates.
2. **Packaged character lookup**: call a public character-breakdown lookup with a Hanzi and observe its immediate components, meanings, pinyin, roles, and unknown markers. Verify known examples against Make Me a Hanzi source records, and verify that the built extension contains the licensed, extension-local data files.
3. **Background meaning request**: send the public meaning-translation message through the service worker and observe Vietnamese output, cached reuse, and English fallback on failure. Stub only the external translation provider/network and browser storage boundary.
4. **User-facing tooltip interaction**: interact with the rendered Hanzi buttons and separate breakdown card through DOM events. Cover the off/on setting, focused character switching, loop-off and X behavior, drill-down/back, tooltip closing, independent dragging, and clicks inside the card not closing the parent tooltip.

Tests will assert visible text, accessible controls, persisted values, or public responses. They will not call private methods or assert internal call order.

## Preparation

- Pin a Make Me a Hanzi source commit and store its `dictionary.txt` and LGPL license/notice in a third-party source directory. Record provenance; do not fetch live data during extension build.
- Add a build step that converts source lines into per-codepoint JSON under a new `dist/hanzi-dictionary/` directory, retaining the fields needed for decomposition, meanings, pinyin, radical, and etymology roles. Keep this data distinct from the existing Arphic-licensed stroke files. Expose it through the manifest for content scripts.
- Parse IDS operators with their correct arity (binary versus ternary), preserve unknown `？` nodes, and stop at the immediate components until the user drills down. Resolve a component's own record lazily; represent missing definitions explicitly.

## Red → green slices

1. **Default settings**: a popup/settings test first fails for the two new controls; add fields, defaults, control markup, loading, saving, and live settings propagation. Preserve current behavior when breakdown is off.
2. **Packaged data**: a known-source example such as 妈 → 女 + 马 first fails at the lookup seam; add pinned data, conversion, loader, and license packaging. Follow with a partial/unknown example and a multi-level example such as 想 → 相 + 心, then 相 → 木 + 目.
3. **English breakdown card**: a DOM test first fails when a looping Hanzi should open a separate card; add the card and render one level with known component meanings and roles only when supported by source data. Keep the existing loop toggle and multiple independent loops.
4. **Card lifecycle**: add one behavior test at a time for focus switching, loop-off close, X close without stopping the loop, original tooltip close, and a subsequent click reopening the card.
5. **Drill-down/back and incomplete data**: test moving to a component and returning in the same card, then test visible unknown markers rather than fabricated meanings.
6. **Meaning language**: test English and Vietnamese labels. Add the background request for on-demand Vietnamese meaning translation, successful-result cache, and English fallback when unavailable. Protect against a late response overwriting a newer focused character or language choice.
7. **Independent card interaction**: test dragging the breakdown card separately from the original tooltip, and test that clicking, selecting text, and dragging in the breakdown card do not trigger the document listener that closes the original tooltip.

Each slice follows one failing behavior test, minimal implementation, then the next slice. After the behavior is complete, run a code-review pass and make any warranted refactor separately from the red → green cycles.

## Final verification

- Run the focused tests after each slice, then `npm test` and `npm run build` once the feature is complete.
- Inspect `dist/` for representative dictionary files and the corresponding license, and verify manifest access.
- Manually check a simplified character, a traditional character, a character with partial decomposition, Vietnamese/English switching, and closing/dragging behavior in the extension UI if browser execution is available.

## Integration notes

- `src/content/tooltip.ts` currently uses a Hanzi button click to toggle looping; the new card must use that same state rather than taking over the click.
- `src/content/translation-init.ts` hides the original tooltip on document mousedown outside its root; the separate card must be recognized as an extension-owned surface.
- The content script should request meaning translation through the existing background messaging path so it uses the configured provider and its host permissions.
- Keep Vietnamese translation on demand and cache successful glosses. If unavailable, render the source English gloss. Do not translate Hanzi or pinyin.
