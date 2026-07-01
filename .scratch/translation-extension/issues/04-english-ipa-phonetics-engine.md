Status: ready-for-agent

# Issue 04: English IPA Phonetics Engine (Offline)

Implement the English IPA generation module using a bundled JSON pronouncing dictionary.

## Parent

- [.scratch/translation-extension/PRD.md](file:///d:/Workspace/translation-extention/.scratch/translation-extension/PRD.md)

## What to build

1. Obtain or compile a lightweight JSON pronouncing dictionary of English words to IPA (covering approx. 30,000–50,000 common words). Embed it as a static asset in the extension.
2. Implement the `PhoneticEngine` module in TypeScript for English. It must:
   - Accept an English sentence/phrase.
   - Tokenize the sentence into individual words (ignoring casing and punctuation).
   - Perform a dictionary lookup for each word to retrieve its IPA.
   - Assemble the individual IPAs back into a sentence string, maintaining original punctuation.
   - Degrade gracefully for unknown words (leave the word as-is or show original spelling).
3. Write unit tests for the English phonetic engine verifying sentence-level IPA conversion and fallback scenarios.

## Acceptance criteria

- [ ] A compact JSON dictionary is bundled offline within the extension workspace.
- [ ] `PhoneticEngine` tokenizes sentences, performs lookups, and maps words to IPA accurately.
- [ ] Punctuation and casing boundaries are handled correctly.
- [ ] Graceful degradation is verified for out-of-vocabulary words.
- [ ] Unit tests pass for English sentence-to-IPA conversion.

## Blocked by

- [02-translation-service-and-settings-storage.md](file:///d:/Workspace/translation-extention/.scratch/translation-extension/issues/02-translation-service-and-settings-storage.md)
