Status: ready-for-agent

# Issue 02: Translation Service & Settings Storage

Implement the core translation service using the unofficial Google Translate API, and set up settings storage.

## Parent

- [.scratch/translation-extension/PRD.md](file:///d:/Workspace/translation-extention/.scratch/translation-extension/PRD.md)

## What to build

1. Implement `SettingsManager` in TypeScript using `chrome.storage.local`. It must store:
   - `primaryTargetLang` (default: `vi`)
   - `secondaryTargetLang` (default: `en`)
   - `triggerMode` (`auto` or `icon`)
   - `hotkey` (`none`, `ctrl`, `alt`, `shift`)
   - `ttsEnabled` (default: `true`)
2. Implement `TranslationEngine` in TypeScript to query the free Google Translate endpoint (`https://translate.googleapis.com/translate_a/single?client=gtx`).
3. Setup message passing between the Content Script and the Background Service Worker: when the Content Script requests a translation, the Service Worker performs the HTTP fetch and returns the response.
4. Auto-toggle target language: if the detected source language is the same as the user's `primaryTargetLang`, translate the text to `secondaryTargetLang`.
5. Write unit tests for `TranslationEngine` and target language selection logic.

## Acceptance criteria

- [ ] `SettingsManager` successfully saves and loads all configurations to/from Chrome storage.
- [ ] `TranslationEngine` correctly constructs the translation query, makes requests, and parses translated text and detected source language.
- [ ] Auto-toggle target language correctly switches to the secondary target language when the source text matches the primary target language.
- [ ] Message passing correctly routes translation requests through the Service Worker.
- [ ] Unit tests pass for translation URL construction and response parsing.

## Blocked by

- [01-project-scaffolding-and-setup.md](file:///d:/Workspace/translation-extention/.scratch/translation-extension/issues/01-project-scaffolding-and-setup.md)
