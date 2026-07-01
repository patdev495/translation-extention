# Translation Extension

Chrome extension for translation between English, Vietnamese, and Chinese, with learning aids like IPA and Pinyin.

## Language

**Translation Engine**:
The mechanism used to translate text.
_Avoid_: Google Translate Web interface, Official Translate API

**Source Text**:
The text selected by the user or extracted by OCR from a user-selected image region, then sent for translation.
_Avoid_: Selected text, Input text, OCR output

**Image Region**:
A rectangular area selected by the user on a rendered page or image as the input for OCR before translation.
_Avoid_: Screenshot area, Crop box

**OCR Selection Mode**:
A mode where the user selects an Image Region, the extension extracts Source Text from that region, and the existing Translation Tooltip displays the translation.
_Avoid_: Screenshot translation mode, Area translate mode

**OCR Progress Indicator**:
The visible feedback shown after an Image Region is selected while OCR and translation are running.
_Avoid_: Loading spinner, Processing badge

**Trigger Mode**:
The configuration determining how the translation popup is activated upon text selection.

**Auto Mode**:
A Trigger Mode where the translation popup appears immediately after the user selects text.

**Icon Mode**:
A Trigger Mode where a small icon button appears near the selected text, which the user must click to show the translation popup.

**Hotkey**:
A modifier key (e.g., Ctrl, Alt, Shift) that the user must hold while selecting text to trigger the translation.

**OCR Shortcut**:
The configurable keyboard shortcut that toggles OCR Selection Mode.
_Default_: Ctrl+Space

**PDF OCR Scope**:
The initial OCR Selection Mode boundary where Image Region selection is supported inside the extension's PDF viewer before general webpage images.
_Avoid_: Global OCR, Website OCR

**OCR Model Tier**:
The PP-OCRv6 model size configuration ('tiny' | 'small' | 'medium') used for local OCR in OCR Selection Mode.
_Default_: PP-OCRv6 small

**OCR Line Breaks**:
The original line breaks preserved from OCR output when showing the Source Text and sending it to translation.
_Avoid_: Flattened OCR text

**OCR Model Cache**:
The locally stored OCR model files downloaded on first use so later OCR Selection Mode runs can work without downloading the model again.
_Avoid_: Bundled OCR model, Temporary model download

**Primary Target Language**:
The user's preferred language for receiving translations (typically Vietnamese).

**Secondary Target Language**:
The fallback language used for translation when the detected Source Language is the same as the Primary Target Language (typically English or Chinese).

**Source Language**:
The language of the Source Text, detected automatically during translation.

**TTS (Text-to-Speech)**:
The text-to-speech capability (audio button) that reads aloud the Source Text.

**Phonetic Transcription**:
The pronunciation representation (IPA for English, Pinyin for Chinese) shown in the Translation Tooltip.

**Translation Tooltip**:
The floating popup card displayed near the selected Source Text containing the translation, Phonetic Transcription, and TTS controls.

**Dual Translation**:
The execution of translating the Source Text into two distinct target languages simultaneously and displaying both in the Translation Tooltip.

**Reverse Target Language**:
The third fallback language configured by the user, which dynamically replaces either the Primary or Secondary Target Language if the detected Source Language matches one of them.

**Translation Provider**:
The active translation engine service (e.g., Google Translate or DeepL API) used by the extension to translate texts.

**DeepL API Key**:
The personal authentication token used to authorize requests against the DeepL Translation API.

**CMU Pronouncing Dictionary (Offline IPA)**:
The lightweight JSON pronouncing dictionary database (`cmu-dict.json`) containing IPA phonetic mappings for common English words, used by the Phonetics Engine offline.

**Pinyin Pro**:
The offline Chinese-to-Pinyin conversion library (`pinyin-pro`) integrated into the Phonetics Engine to transcribe Chinese characters with tone marks.

**Dictionary Integration**:
The quick-access buttons in the Translation Tooltip pointing to external dictionaries (Cambridge Dictionary for English, Hanzii for Chinese) for deep learning.

**Shadow DOM Isolation**:
The encapsulation mechanism used to render the Translation Tooltip, ensuring its glassmorphism styles are unaffected by the styles of the host webpage.

**Draggable Tooltip**:
The user interaction capability enabling the Translation Tooltip to be dragged anywhere on the screen by clicking and holding the card (excluding buttons/inputs).

**Copy to Clipboard**:
The quick-copy action button in the Tooltip allowing the user to copy the source text or translation to their clipboard.

**TTS Voice Diagnostics**:
The logging system in the console that outputs warning diagnostics if no matching system voice is found for the required locale during text-to-speech playback.






