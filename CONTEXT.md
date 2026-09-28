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

**Translation Active State**:
The enabled or disabled status of the translation feature. When enabled, text selections are automatically translated and displayed in the Translation Tooltip. When disabled, webpage text translation is skipped.


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

**Direct Primary Translation**:
Translation explicitly requested into the Primary Target Language, without changing the target according to the detected Source Language. It requires an enabled Primary Target Language.
_Avoid_: Automatic target selection, Fallback translation

**Input Replacement Translation**:
The translation of a selected text segment directly inside an editable field, replacing only that selected segment with text in the Primary Target Language.
_Avoid_: Input translation, Inline translation, Replace all text

**Editable Field**:
A text input, textarea, or contenteditable region in which Input Replacement Translation may replace a selected text segment. Password fields are excluded.
_Avoid_: Input box, Text box, Password field

**Eligible Input Selection**:
A non-empty text selection inside an Editable Field that can be replaced by Input Replacement Translation.
_Avoid_: Empty selection, Cursor position

**Input Replacement Shortcut**:
The configurable key combination that triggers Input Replacement Translation. When Input Replacement Translation is enabled, a shortcut is mandatory; selecting Disabled turns off the feature.
_Avoid_: Auto-translate shortcut, Optional shortcut

**Left-Control Tap**:
The default Input Replacement Shortcut: pressing and releasing the left Control key without pressing another key while it is held.
_Avoid_: Ctrl+Left Arrow, Control-key combination

**Stale Input Translation**:
An Input Replacement Translation result whose original Editable Field, focus, or selected text has changed before the result is ready. It is discarded without modifying the field.
_Avoid_: Delayed translation, Pending replacement

**Input Translation Status**:
The short visual feedback displayed beside an Editable Field while Input Replacement Translation is in progress or when it fails.
_Avoid_: Translation tooltip, Persistent notification

**Undoable Input Replacement**:
An Input Replacement Translation applied as one editable operation that the user can reverse to restore the original selected text.
_Avoid_: Permanent replacement, Multi-step edit

**Secondary Target Language**:
The fallback language used for translation when the detected Source Language is the same as the Primary Target Language (typically English or Chinese).

**Source Language**:
The language of the Source Text, detected automatically during translation.

**TTS (Text-to-Speech)**:
The text-to-speech capability (audio button) that reads aloud the Source Text.

**Phonetic Transcription**:
The pronunciation representation (IPA for English, Pinyin for Chinese) shown in the Translation Tooltip.

**Phonetics Visibility State**:
The configuration setting determining whether Phonetic Transcription is displayed inside the Translation Tooltip.
_Default_: true
_Avoid_: Pronunciation toggle, Phonetics switch


**Translation Tooltip**:
The floating popup card displayed near the selected Source Text containing the translation, Phonetic Transcription, and TTS controls.

**Tooltip Font Size**:
The configuration determining the font size of the text (Source Text, translations, and phonetics) rendered inside the Translation Tooltip.
_Default_: 14px


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
The logging system in the console that outputs warning diagnostics if no matching system voice is found for the required locale during text-to-speech playback.**OCR Pin Image**:
The configuration setting determining whether the cropped Image Region is displayed as a pinned floating card on the screen.
_Default_: false

**Pinned Snippet Panel**:
The draggable, persistent floating card displaying the cropped Image Region on the screen when OCR Pin Image is enabled, synchronized and replicated across all active browser tabs using local storage.
_Avoid_: Screenshot float, Screenshot sticker

**OCR Copy to Clipboard**:
The configuration setting determining whether the cropped Image Region is automatically copied to the system clipboard upon successful OCR extraction.
_Default_: false


