# Settings popup tabs

## Confirmed decisions

- Settings will be divided into tabs inside the existing extension action popup.
- Use the user's proposed tab names: Languages, Provider, Display, Website, OCR.
- Use the agreed grouping below, with Tooltip, Hanzi, and Backup subgroups in Display.

## Current settings coverage audit

Audited against `popup/index.html`, `popup/popup.ts`, and `src/services/settings.ts`. All 19 fields of the current Settings interface have a destination:

| Tab | Settings fields |
| --- | --- |
| Languages | primaryTargetLang, secondaryTargetLang, reverseTargetLang |
| Provider | provider, deeplApiKey, autoTranslate, inputReplacementEnabled, inputReplacementShortcut |
| Display | tooltipFontSize, ttsEnabled, phoneticsVisible, hanziStrokeSpeed, hanziBreakdownEnabled, hanziBreakdownLanguage |
| OCR | ocrShortcut, ocrModelTier, ocrLanguage, ocrPinImage, ocrCopyToClipboard |
| Website | Account Link and learning sync controls; these are separate from the Settings interface |

Associated controls and feedback must move with their owning group:

- Provider: conditional DeepL API key field, show/hide key button, validation status, translation shortcut capture, and shortcut errors.
- Display / Backup: export JSON, import JSON, file picker, import summary, Keep current / Use file conflict choices, and backup status. This backs up personal Hanzi meanings and memory notes.
- Website: website URL, link / reopen pending link / unlink account actions, account status and errors, sync list and per-item state/error, and retry action.
- OCR: the copy control copies the cropped Image Region, not the extracted Source Text.

## Shared popup elements

- Keep the extension active toggle in the header outside the tabs. Its `active` storage value is separate from Settings.
- Preserve the initial privacy consent screen, policy link, and accept button as a popup-wide onboarding state. Settings stay hidden and the active toggle disabled until consent; `privacyConsentGranted` is separate from Settings.
- Preserve the shared Settings saved feedback and current automatic saving behavior.

## Cross-tab dependencies to preserve

- Disabling Primary Target in Languages turns off Input Replacement Translation configured in Provider.
- The translation shortcut in Provider cannot conflict with the OCR shortcut in OCR. The current error is rendered in the Provider section even when changing the OCR shortcut; tabbed UI must make this error visible to the learner.
- Phonetics Visibility State may change from the Translation Tooltip and updates the popup while it is open.

## Implementation decisions

- The user authorized planning, implementation, commit, and push after confirming the grouping and requesting a coverage audit.
- Remember the last tab under the separate `settingsPopupTab` local storage entry. A missing or invalid preference starts in Languages. A delayed restore never overrides a newer user selection.
- Retain the 640px width and use a 560px popup height, below the 600px cap. The active panel scrolls independently of the shared header, tabs, and footer.
- Arrow keys wrap through tabs; Home and End select the first and last tabs. Each active panel is keyboard focusable, and inactive panels remain mounted but hidden so backup choices and field values survive tab switches.
- Display OCR shortcut conflicts in OCR and Provider; display the Primary Target dependency in Languages and Provider.
- Allow Tab to leave the translation shortcut capture field without replacing the configured shortcut.
