# Chrome Web Store privacy fields for PolyTranslate

Use this text with the build that includes the consent gate. Keep it in sync with `docs/privacy-policy.md` and the uploaded ZIP. The privacy policy URL is `https://github.com/patdev495/translation-extention/blob/develop/docs/privacy-policy.md` after this change is pushed to the public `develop` branch. Verify the URL before entering it in the Developer Dashboard.

## Single purpose

Translate user-selected text and text recognized from user-selected image regions between English, Vietnamese, and Chinese, with pronunciation and Hanzi learning aids.

## Permission justifications

| Permission | Suggested justification |
| --- | --- |
| `storage` | Save language and feature settings, the user's optional DeepL API key, Hanzi learning notes, cached character meanings, and optionally pinned image regions on the user's device. |
| `webNavigation` | Detect PDF navigation so the extension can open PDFs in its viewer for text selection and OCR translation. |
| `tabs` | Open the extension settings page, redirect PDF tabs into the viewer, and notify open tabs when settings change. |
| `offscreen` | Run local OCR in an offscreen document for image regions the user selects on a web page. |
| `activeTab` | Capture the visible tab after the user activates OCR selection, so the selected image region can be recognized locally. Review whether this permission is redundant with broad host access before submission. |
| `clipboardWrite` | Copy translated text or an OCR image to the clipboard when the user invokes that feature or enables image copying. |
| `<all_urls>` and `file://*/*` | Show translation controls on web pages and supported local PDF files and read PDF content for the extension viewer. Explain the all-sites access clearly in the listing. Review whether all declared host entries are necessary before submission. |
| `https://translate.googleapis.com/*` | Send text chosen for translation to Google Translate. This entry may be redundant with `<all_urls>` and should be reviewed before submission. |

## Remote code

Select **No** if the submitted package is built from this source and no remote scripts are added. The translation requests return data; OCR, pronunciation, PDF, and Hanzi code are packaged with the extension.

## Data use disclosure

Disclose **website content** and **user-generated content**: the extension reads selected text, selected editable-field content, and text extracted from selected image regions. The selected content may also include **personal communications or personally identifiable information** depending on the user's selection. Disclose **authentication information** for the optional DeepL API key. Explain that the image region is processed locally and only recognized text is sent to the chosen translation provider. Settings, API key, notes, pinned images, and cached Hanzi meanings are stored locally. PDF URLs are inspected for the viewer feature but are not retained as browsing history by the extension.

Certify the Limited Use statements only after checking the final release package and the published privacy policy. Do not claim that translation is fully offline: Google and DeepL requests require network access. Do not claim that DeepL keys are encrypted at rest by the extension: they are saved in `chrome.storage.local`.

## User-facing disclosure

The popup explains the external transfer and requires the user to select **Tôi đồng ý và bật dịch** before any translation request. After consent, selecting text can trigger an automatic request while Auto Translate is enabled. This behavior should be stated in the Store listing as well.
