# Settings popup tabs implementation plan

## Scope

Organize the existing action popup into Languages, Provider, Display, Website, and OCR tabs, preserving all controls inventoried in NOTES.md and existing setting values.

## Steps

1. Add accessible tab buttons and panels; keep the power toggle, privacy consent, and saved feedback shared. Split Display into Tooltip, Hanzi, and Backup groups.
2. Keep the existing 640px width and cap popup height at 600px. Keep the header, tabs, and footer visible while the active panel scrolls.
3. Support click, arrow keys, Home, and End navigation. Remember the last tab in a separate local storage entry; default to Languages for a new or invalid preference. Changing tabs must not save settings or discard pending backup choices.
4. Preserve automatic saving and validation. Show OCR shortcut conflicts in OCR as well as Provider; surface the Primary Target requirement in Languages when it disables input replacement.
5. Verify tab persistence, keyboard focus, privacy consent, cross-tab dependencies, settings coverage, and existing popup workflows. Run the unit suite, build, and inspect the rendered popup in Chromium.
6. Review the diff, commit only this feature's files, and push the feature branch.

## Validation results

- `npm test`: 36 files, 160 tests passed, including 7 new tab interaction tests and existing Hanzi backup, speed, breakdown, account sync, privacy, and packaging checks.
- `npm run build`: passed (TypeScript and extension packaging).
- Chromium 158 smoke check on the built extension: privacy gate and consent acceptance, all five panels, tab restoration after reload, keyboard navigation, independent panel scrolling with stationary tabs, and no page errors passed.
- Layout check at 640px and 360px: no horizontal overflow; Display and narrow OCR screenshots inspected.
- Coverage audit: all 31 original identified controls retained, no duplicate IDs; all 19 Settings fields retain their existing load/save flow.
- `git diff --cached --check`: passed.
