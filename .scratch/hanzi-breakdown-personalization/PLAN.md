# Implementation plan: personal Hanzi breakdown content

## Scope and constraints

Implement the behavior in `PRD.md`. Keep source dictionary and stroke files immutable. Use exact Unicode characters as keys. Store personal meanings per character and breakdown language; store one note and one unknown-stroke explanation per character. The extension's `chrome.storage.local` is the primary store; JSON files are user-triggered backups. The feature works without network access except for the existing Vietnamese translation of original meanings.

## Public seams proposed for TDD confirmation

1. **Hanzi Breakdown Tooltip UI:** Open a character through the existing `TranslationTooltip` interface and interact with its rendered card. Verify visible meanings, independent toggles, note fields, nested navigation, save status, and reopening. Treat Chrome storage and packaged data fetches as system boundaries in tests.
2. **Extension popup backup UI:** Use the rendered popup controls to export/import a JSON file. Verify the exported content and the learner-visible result of importing, including conflict choice and invalid-file feedback. Treat browser file/download APIs and Chrome storage as system boundaries.

No tests will target private methods, storage key shapes, or helper call counts. Verify unmatched strokes through the tooltip's rendered SVG using fixed source characters and expected visible strokes.

## Vertical TDD slices

For every slice: write one failing behavioral test at an agreed seam, run it and confirm red, implement only enough to turn it green, then continue.

1. **Memory note and persistence.** Show a labeled multiline note field at the bottom of the card. Enter text, close, reopen, and see it again. Save on input so immediate close cannot discard text; show saving/saved/error state. Preserve note content across navigation and language changes.
2. **Personal meaning for the main character.** Edit its meaning, reopen to see the personal version first, then toggle to the original. Keep the original text immutable. Make empty personal text mean no personal version.
3. **Components and scope.** Edit 目 within 見 and confirm the same personal meaning appears when 目 is opened elsewhere. Confirm independent toggles and separate Vietnamese/English personal meanings. Verify simplified and traditional characters remain separate.
4. **Unidentified strokes.** Read the dictionary's `matches` and packaged stroke paths for the current character. Render all strokes with null matches as one SVG visual, replacing every `？` row with one grouped row. Keep the fallback “Chưa xác định” and allow one explanation specific to the parent character. Verify a known example such as 伤 with an independently specified stroke count/shape expectation, and a character with multiple unknown slots.
5. **JSON export.** Add backup controls in the Hanzi area of the popup. Export a versioned, validated JSON document containing personal meanings, notes, and unknown-stroke explanations but no unrelated settings. Give the user a downloadable file.
6. **JSON import.** Parse and validate the file before modifying local content. Merge entries absent locally. If values conflict, show a summary and ask whether to keep current values or use imported values, applying that choice to conflicts only. Verify both choices and malformed files through the popup seam.
7. **Final behavior and review.** Run targeted tests after each slice; at the end run the full test suite and build. Manually inspect the tooltip and popup if a browser surface is available. Review the diff against `PRD.md`, fix concrete issues, and update the issue status.

## Implementation shape

- Add a small storage module for typed learner content. Use per-character storage keys or equivalent atomic writes so edits from multiple tabs do not overwrite unrelated characters. Validate incoming JSON and serialize through a versioned backup schema.
- Extend the existing breakdown lookup result with unmatched stroke data derived from `matches` and the packaged Hanzi Writer paths. If a record has no matching graphics, show a clear unknown fallback; never invent a named component.
- Extend the card rendering in `src/content/tooltip.ts` with editable meaning fields, per-item view toggles, a bottom note field, and an unknown-stroke explanation field. Use `textContent`/form values for learner input, not HTML injection. Keep drag behavior out of editable controls.
- Add the export/import controls in `popup/index.html`, `popup/popup.ts`, and `popup/popup.css`. Reuse the storage module; do not put backup data into extension settings.
- Keep the dictionary's source meaning and personal meaning distinct in memory and in JSON. Clear personal text without erasing the original. A temporary toggle choice resets to personal-first when a breakdown is opened again.

## Risks to verify

- A character can have several `？` slots, but `matches: null` gives no per-slot identity. Grouping all unmatched strokes avoids a false attribution.
- The dictionary and stroke graphics are packaged separately. Verify the stroke count matches `matches` before using indices; fall back safely if they differ.
- The card can rerender during language changes and nested navigation. Pending saves and the current edit must not be lost.
- Chrome local data survives normal browser restarts and extension updates but can be removed when the extension is uninstalled or its data is cleared; JSON export is the user-controlled backup path.
