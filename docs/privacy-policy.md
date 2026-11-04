# PolyTranslate Privacy Policy

Last updated: November 4, 2026

PolyTranslate translates text selected on web pages and PDFs, translates selected text in editable fields, and recognizes text in image regions selected by the user. This policy describes the data used by the Chrome extension.

## Data used to provide translation

When translation is enabled, PolyTranslate sends the text you select, type and explicitly choose to translate, or extract from a selected image region to your chosen translation provider over HTTPS. The default provider is Google Translate (`translate.googleapis.com`). If you select DeepL, the extension sends the text to DeepL (`api-free.deepl.com` or `api.deepl.com`). Selected text may contain personal information, communications, or other sensitive material, depending on what you select. Automatic translation of selected text is on by default after you agree to the disclosure in the extension popup; you can turn it off or disable the extension there.

If you enter a DeepL API key, PolyTranslate stores it in Chrome's local extension storage on your device. The key is sent to DeepL over HTTPS when checking its validity or making a DeepL translation request. It is not sent to Google Translate.

The chosen translation provider may process and retain requests according to its own privacy terms: [Google Privacy Policy](https://policies.google.com/privacy) and [DeepL Privacy Policy](https://www.deepl.com/privacy). PolyTranslate does not control those providers' retention practices.

## Data processed on your device

Image regions selected for OCR are processed locally by the extension. The image itself is not sent to the translation provider; only recognized text is sent when you request translation. If you enable image pinning, the cropped image is stored in Chrome's local extension storage and shown across your open tabs. If you enable copying, the cropped image is written to your clipboard. OCR model files are loaded from the extension package.

PolyTranslate stores your settings, DeepL API key, pinned image regions, cached translated Hanzi meanings, and any personal Hanzi meanings or memory notes in Chrome's local extension storage. Hanzi learning notes can be exported to and imported from a JSON file that you choose. The extension does not use Chrome Storage Sync for this data. Pronunciation data and Hanzi stroke data are bundled with the extension. Text to speech uses the browser's speech synthesis feature; the browser or selected voice may have its own data handling.

The extension can read page text that you select and detect PDF navigation so it can provide its translation and PDF viewer features. It does not send browsing history to the developer. If you click a Cambridge Dictionary or Hanzii link in the translation tooltip, your browser opens that third-party site with the selected word or phrase in the URL; that site handles the request under its own policy.

## Sharing and retention

The extension does not contain analytics, advertising, or a developer-operated collection server. It does not sell user data. It shares text only with the translation provider selected for the feature, and sends a DeepL API key only to DeepL when DeepL is used or the key is validated. User-initiated dictionary links open the named third-party sites.

Data stored by the extension remains on your device until you change or remove it, clear Chrome's extension data, or uninstall the extension. Exported JSON files and clipboard contents are under your control. Google, DeepL, Cambridge Dictionary, and Hanzii set their own retention periods for data they receive.

## Your choices and contact

You may disable automatic translation or the entire extension in the popup. You can choose Google or DeepL, remove the saved DeepL key by clearing its field and saving settings, and remove pinned images using their controls. You may clear all extension data or uninstall PolyTranslate through Chrome. To ask about this policy, use the [project issue tracker](https://github.com/patdev495/translation-extention/issues).

PolyTranslate's use of information received from Google APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies/), including its Limited Use requirements.
