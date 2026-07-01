Status: ready-for-agent

# Issue 05: Basic Tooltip & Selection Event

Implement text selection monitoring and render a basic floating tooltip on pages.

## Parent

- [.scratch/translation-extension/PRD.md](file:///d:/Workspace/translation-extention/.scratch/translation-extension/PRD.md)

## What to build

1. Implement `TextSelectionMonitor` in the Content Script to detect selection text using `window.getSelection()`.
2. Retrieve the coordinates of the selected text boundaries using `Range.getBoundingClientRect()`.
3. Create a floating tooltip element inside a Shadow DOM container appended to the webpage to avoid CSS conflicts.
4. Integrate the basic layout displaying:
   - Selected text (Source Text)
   - Translated text (retrieved from `TranslationEngine`)
   - Phonetic transcription (retrieved from `PhoneticEngine`) if the source language is English or Chinese.
5. Hide the tooltip when clicking outside the tooltip or when selection changes.

## Acceptance criteria

- [ ] Selecting text on any webpage correctly triggers selection capture.
- [ ] Tooltip is injected into a Shadow DOM at the correct selection coordinates.
- [ ] Translation and phonetics are correctly loaded into the tooltip.
- [ ] Tooltip closes when clicking elsewhere on the page.

## Blocked by

- [03-chinese-pinyin-phonetics-engine.md](file:///d:/Workspace/translation-extention/.scratch/translation-extension/issues/03-chinese-pinyin-phonetics-engine.md)
- [04-english-ipa-phonetics-engine.md](file:///d:/Workspace/translation-extention/.scratch/translation-extension/issues/04-english-ipa-phonetics-engine.md)
