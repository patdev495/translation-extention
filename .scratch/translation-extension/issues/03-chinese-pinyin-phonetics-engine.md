Status: ready-for-agent

# Issue 03: Chinese Pinyin Phonetics Engine (Offline)

Implement the Chinese Pinyin generation module using the local `pinyin-pro` library.

## Parent

- [.scratch/translation-extension/PRD.md](file:///d:/Workspace/translation-extention/.scratch/translation-extension/PRD.md)

## What to build

1. Integrate the `pinyin-pro` library (minified/bundled offline) into the extension.
2. Implement the `PhoneticEngine` module in TypeScript for Chinese. It must accept a Chinese sentence (characters) and output its Pinyin phonetic representation with tone marks offline.
3. Write unit tests for the Chinese phonetic engine verifying sentence-level conversion, including punctuation handling.

## Acceptance criteria

- [ ] `pinyin-pro` is integrated and loaded offline.
- [ ] `PhoneticEngine` accurately converts Chinese characters to Pinyin strings with tone marks.
- [ ] Non-Chinese characters and punctuation are preserved correctly.
- [ ] Unit tests pass for various Chinese sentence inputs.

## Blocked by

- [02-translation-service-and-settings-storage.md](file:///d:/Workspace/translation-extention/.scratch/translation-extension/issues/02-translation-service-and-settings-storage.md)
