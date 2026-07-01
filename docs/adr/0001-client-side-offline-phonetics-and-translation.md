# 0001-client-side-offline-phonetics-and-translation

We will implement the translation and phonetic transcriptions (Pinyin and English IPA) completely client-side in the Chrome Extension to run 100% offline, securely, and with zero external API dependencies for pronunciation. For translation, we will fetch the free, unofficial Google Translate endpoint.

## Context

The user wants translation between English, Vietnamese, and Chinese. Translating to English or Chinese requires showing phonetic transcriptions (IPA or Pinyin) of the entire selected sentence/text.
Official translation APIs (Google Cloud, etc.) require API keys, which are paid and hard for end-users to set up.
Fetching IPA for English sentence-level text via external APIs is slow and rates are limited. Running a Python backend requires the user to run a local server, which hampers usability.

## Decision

1. Use the free Google Translate API endpoint (`https://translate.googleapis.com/translate_a/single?client=gtx`) for translating text.
2. Use the open-source JavaScript library `pinyin-pro` (bundled locally in the extension) to convert Chinese characters to Pinyin offline.
3. Bundle a lightweight English IPA dictionary (~30,000 to 50,000 common words) as a JSON asset in the extension. When English text is selected, the extension will tokenize the text and map each word to its IPA transcription locally.
4. Provide TTS (Text-to-Speech) using the native browser Web Speech API (`window.speechSynthesis`), which works offline and doesn't require API calls.

## Consequences

- The extension will be 100% self-contained and free to use.
- The extension bundle size will increase by ~1-2 MB to store the English IPA dictionary, which is negligible for a Chrome extension.
- Rare or out-of-vocabulary English words may not have IPA transcriptions.
