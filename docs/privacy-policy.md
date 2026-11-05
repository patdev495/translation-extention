# PolyTranslate Privacy Policy

Last updated: November 5, 2026

PolyTranslate translates text selected on web pages and PDFs, translates selected text in editable fields, and recognizes text in image regions selected by the user. The optional PolyTranslate Learning website lets you create an account and organize learning folders. This policy describes both the Chrome extension and the companion website.

## Data used to provide translation

When translation is enabled, PolyTranslate sends the text you select, type and explicitly choose to translate, or extract from a selected image region to your chosen translation provider over HTTPS. The default provider is Google Translate (`translate.googleapis.com`). If you select DeepL, the extension sends the text to DeepL (`api-free.deepl.com` or `api.deepl.com`). Selected text may contain personal information, communications, or other sensitive material, depending on what you select. Automatic translation of selected text is on by default after you agree to the disclosure in the extension popup; you can turn it off or disable the extension there.

If you enter a DeepL API key, PolyTranslate stores it in Chrome's local extension storage on your device. The key is sent to DeepL over HTTPS when checking its validity or making a DeepL translation request. It is not sent to Google Translate.

The chosen translation provider may process and retain requests according to its own privacy terms: [Google Privacy Policy](https://policies.google.com/privacy) and [DeepL Privacy Policy](https://www.deepl.com/privacy). PolyTranslate does not control those providers' retention practices.

## Data processed on your device

Image regions selected for OCR are processed locally by the extension. The image itself is not sent to the translation provider; only recognized text is sent when you request translation. If you enable image pinning, the cropped image is stored in Chrome's local extension storage and shown across your open tabs. If you enable copying, the cropped image is written to your clipboard. OCR model files are loaded from the extension package.

PolyTranslate stores your settings, DeepL API key, pinned image regions, cached translated Hanzi meanings, and any personal Hanzi meanings or memory notes in Chrome's local extension storage. Hanzi learning notes can be exported to and imported from a JSON file that you choose. The extension does not use Chrome Storage Sync for this data. Pronunciation data and Hanzi stroke data are bundled with the extension. Text to speech uses the browser's speech synthesis feature; the browser or selected voice may have its own data handling.

If you link the optional website, the extension stores its account access token in the extension's own IndexedDB storage. Page content scripts receive only a public linked/unlinked status, not the token. The extension uses the token to check or revoke the link. Linking does not upload your existing Hanzi notes, image regions, browsing history, or translation history.

The extension can read page text that you select and detect PDF navigation so it can provide its translation and PDF viewer features. It does not send browsing history to the developer. If you click a Cambridge Dictionary or Hanzii link in the translation tooltip, your browser opens that third-party site with the selected word or phrase in the URL; that site handles the request under its own policy.

## Companion website account data

The website API receives the username and password you submit to register or sign in. It stores your username, an Argon2 password hash, session records, and the names and hierarchy of folders you create. The web session is held in an HTTP-only cookie; the linked extension uses a separate revocable token. The API uses these records to keep each account's folders separate. The current website feature does not receive saved words or sentences; that requires a later feature.

The local development server runs on your own computer. A deployed website requires HTTPS and an operator to host its account database. Account and folder data remains in that database until removed; signing out or disconnecting the extension does not delete it.

## Sharing and retention

PolyTranslate does not contain analytics or advertising and does not sell user data. The extension sends translated text only to the chosen translation provider, and sends a DeepL API key only to DeepL when used or validated. If you use the companion website, your username and folder data are sent to that website API. User-initiated dictionary links open the named third-party sites.

Data stored by the extension remains on your device until you change or remove it, clear Chrome's extension data, or uninstall the extension. Exported JSON files and clipboard contents are under your control. Google, DeepL, Cambridge Dictionary, and Hanzii set their own retention periods for data they receive.

## Your choices and contact

You may disable automatic translation or the entire extension in the popup. You can choose Google or DeepL, remove the saved DeepL key by clearing its field and saving settings, and remove pinned images using their controls. You may disconnect the companion website in extension settings; this revokes the extension token but keeps your website account and folders. You may clear all extension data or uninstall PolyTranslate through Chrome. To ask about this policy, use the [project issue tracker](https://github.com/patdev495/translation-extention/issues) without posting passwords or other sensitive data.

PolyTranslate's use of information received from Google APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies/), including its Limited Use requirements.
