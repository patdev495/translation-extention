Status: ready-for-agent

# PRD: Chrome Translation Extension (English - Vietnamese - Chinese)

This Product Requirement Document defines the specifications for a Chrome Extension that translates text on web pages between English, Vietnamese, and Chinese, while providing educational aids such as IPA (for English) and Pinyin (for Chinese) offline, along with Text-To-Speech (TTS) pronunciation.

## Problem Statement

When users read content in a foreign language (English or Chinese), they often need to translate sentences to understand them. However, standard translation extensions only show the semantic translation. To actually *learn* the language, users need to know how to pronounce the translated words. Having to manually look up IPA for English words or Pinyin for Chinese sentences in a separate dictionary is tedious and disrupts the reading flow. Furthermore, official translation APIs require API keys, which are costly and complex to set up.

## Solution

A Chrome Extension implemented in **TypeScript** that allows users to select text on any webpage and immediately see:
1. The translation in their primary target language.
2. The full Phonetic Transcription (IPA for English, Pinyin for Chinese) for the entire selected sentence/phrase, calculated entirely client-side/offline.
3. A Text-to-Speech (TTS) button to play the natural audio pronunciation.

The extension uses the free, unofficial Google Translate endpoint to translate text, so it requires zero API keys or user account setups. It features a modern, clean Glassmorphism UI that automatically adjusts to Light/Dark mode.

## User Stories

1. As a language learner, I want to select a text on a webpage and see its translation, so that I can understand its meaning immediately.
2. As an English learner, I want to see the IPA phonetic transcription of the entire selected English text, so that I can learn how to pronounce the sentence correctly.
3. As a Chinese learner, I want to see the Pinyin transcription of the entire selected Chinese text, so that I can read the characters properly.
4. As a user, I want the extension to translate without requiring any API keys or account setup, so that I can start using it immediately.
5. As a reader, I want to be able to hold a hotkey (like Ctrl, Alt, or Shift) while selecting text to trigger translation, so that the translation popup doesn't get in the way when I'm just copying text.
6. As a reader, I want to choose between "Auto Mode" (popup shows immediately on select) and "Icon Mode" (shows a small button first, which I must click to show the popup), so that I can customize my experience.
7. As a learner, I want to click a speaker button in the popup to hear the text read aloud, so that I can practice my listening and pronunciation.
8. As a bilingual reader, I want the extension to automatically detect if the text I selected is already in my Primary Target Language (e.g., Vietnamese), and automatically translate it to my Secondary Target Language (e.g., English), so that I can translate back-and-forth seamlessly.
9. As a user, I want to click a button on the Chrome toolbar to easily change my Primary/Secondary Target Language, Trigger Mode, and Hotkey settings, so that I don't have to navigate to a separate options page.
10. As a user, I want the translation popup to have a modern, sleek Glassmorphism design that integrates beautifully with the webpages I visit.

## Implementation Decisions

### 1. Language Stack & CSS
- The codebase must be written entirely in **TypeScript (TS)**, compiled/bundled using Vite.
- Styling must use **Tailwind CSS v4** for modern utility-first CSS layout and responsive design.

### 2. Core Modules

- **Translation Engine**: Fetches translation via the free endpoint `https://translate.googleapis.com/translate_a/single?client=gtx`. Automatically detects the source language and translates to the configured target language.
- **Phonetics Engine**:
  - Chinese: Integrates a minified bundle of `pinyin-pro` to map Chinese characters to Pinyin offline.
  - English: Embeds a lightweight offline JSON pronouncing dictionary containing IPA for common English words (approx. 30,000–50,000 words). Words not found in the dictionary will degrade gracefully (show original word).
- **Settings Manager**: Manages storage (`chrome.storage.local`) for configurations:
  - `primaryTargetLang` (default: `vi`)
  - `secondaryTargetLang` (default: `en`)
  - `triggerMode` (`auto` or `icon`)
  - `hotkey` (`none`, `ctrl`, `alt`, `shift`)
  - `ttsEnabled` (`true` or `false`)
- **Text Selection Monitor (Content Script)**: Listens for `mouseup` / `selectionchange` on webpages. Validates if the selection is valid, checks hotkey state, and determines if it should trigger the Icon or the Tooltip.
- **Translation Tooltip Component**: Renders a floating shadow DOM element on the page at the selection coordinates. Contains:
  - Source text + TTS speaker button.
  - Phonetic transcription (IPA or Pinyin) in a distinct, styled font size.
  - Translated text.
  - Quick-switch dropdowns for target languages.
- **Extension Action Popup (Popup UI)**: A small interactive popup in the browser bar to toggle settings quickly.

### 3. Translation Logic Flow
1. If the detected Source Language differs from `primaryTargetLang`, translate to `primaryTargetLang`.
2. If the detected Source Language is equal to `primaryTargetLang`, translate to `secondaryTargetLang`.
3. If Source Language is English, call the Phonetics Engine to generate the IPA sentence transcription.
4. If Source Language is Chinese, call the Phonetics Engine to generate the Pinyin sentence transcription.

## Testing Decisions

### 1. Testing Standards
- Tests must verify external behavior (e.g. given an English sentence, does the Phonetics Engine return correct IPA string?) and should not mock internal implementation details unnecessarily.

### 2. Tested Modules
- **Phonetic Engine**: Unit tests verifying:
  - Conversion of Chinese sentences to Pinyin with tone marks.
  - Conversion of English sentences (including punctuation and mixed casing) to IPA.
  - Graceful fallback for unknown words.
- **Translation Engine**: Unit tests verifying the URL request generation and response parsing for the unofficial Google Translate API.

## Out of Scope
- Supporting audio pronunciation download as files.
- Storing translation history or vocabulary notebooks (out of scope for initial MVP).
- Full sentence syntax parsing or grammar explanations.

## Further Notes
- The extension should use a Shadow DOM for the Translation Tooltip to prevent host webpage CSS stylesheets from breaking the tooltip's glassmorphism style.
