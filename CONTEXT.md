# Translation Extension

Chrome extension for translation between English, Vietnamese, and Chinese, with learning aids like IPA and Pinyin.

## Language

**Translation Engine**:
The mechanism used to translate text.
_Avoid_: Google Translate Web interface, Official Translate API

**Source Text**:
The text selected by the user on a webpage to be translated.
_Avoid_: Selected text, Input text

**Trigger Mode**:
The configuration determining how the translation popup is activated upon text selection.

**Auto Mode**:
A Trigger Mode where the translation popup appears immediately after the user selects text.

**Icon Mode**:
A Trigger Mode where a small icon button appears near the selected text, which the user must click to show the translation popup.

**Hotkey**:
A modifier key (e.g., Ctrl, Alt, Shift) that the user must hold while selecting text to trigger the translation.

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




