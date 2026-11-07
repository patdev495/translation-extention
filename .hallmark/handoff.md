# PolyTranslate redesign

Full app redesign using the Coral light palette. The user requested preserving the name and functions, replacing all existing UI, and making it compact, light and modern.

## Outcome

- Settings: language choices first, paired translation and display settings, three OCR fields in a row. All controls fit at 640×600.
- Shared light theme for the Translation Tooltip, PDF viewer, OCR Selection Mode, OCR Progress Indicator, Pinned Snippet Panel and Input Translation Status.
- Native controls and keyboard focus, accessible labels, responsive layouts and reduced motion.
- Styles are bundled inside Shadow DOM for isolated UI. The manifest no longer injects popup CSS into host webpages.
- Pinned panels stay within the viewport on initial load, movement, storage updates and resize.
- No routes, handlers, settings, provider integrations or tests were removed.

## Verification

- Before: Hallmark 79 Floor failures, 29 Reflex findings.
- After: Hallmark 0 Floor failures, 0 Reflex findings, 0 warnings.
- F4 answered: selected OCR state and primary buttons belong to mutually exclusive viewer states.
- Kept: 19/19 fields, 44/44 script hooks, 2/2 recorded headings, 1/1 recorded figure.
- Independent finish review: 3 findings, 3 resolved (pinned phone overflow, density, clipped model selection).
- TypeScript and production build passed.
- 52 tests passed in 14 root test files. The initial default test run also passed 22 tests from an unrelated existing worktree.
- Eight browser verification groups passed with zero browser errors: persistence, DeepL disclosure/key visibility, shortcut conflicts, focus and responsive layouts, long multilingual text, pinned-panel bounds/dismissal, real PDF rendering/zoom/OCR, and host-style isolation.

## Copy adjustments

| Before | After | Reason |
| --- | --- | --- |
| PolyTranslate — Settings | PolyTranslate Settings | Plain document title |
| PDF Viewer — PolyTranslate | PDF Viewer, PolyTranslate | Plain document title |
| / — | / … | Loading placeholder |
| IPA · Pinyin display | IPA / Pinyin display | Remove decorative meta punctuation |
| 12px · Small, 14px · Normal, 16px · Large, 18px · XL, 20px · 2XL, 24px · 3XL | Same values and descriptions in parentheses | Remove decorative meta punctuation |
| Tiny · Fast, Small · Balanced, Medium · Accurate | Tiny (Fast), Small (Balanced), Medium (Accurate) | Remove decorative meta punctuation |
| ENG, VIE, CHI | English, Vietnamese, Chinese | Readable language identifiers |
| language · Source | language / Source | Remove decorative meta punctuation |
| OCR Pinned | Pinned image | Sentence-case panel title |
| Enable file access → | Enable file access | Remove attached decorative arrow |

The generic brand subtitle and short language/OCR helper descriptions remain available to assistive technology; field titles retain the helper descriptions for pointer users.

## Preview and reproduction

- Run `npm run dev -- --host 127.0.0.1 --port 5173`.
- Open `http://127.0.0.1:5173/popup/index.html`.
- Viewer fixture: `http://127.0.0.1:5173/src/pdf-viewer/viewer.html?file=/__preview__/sample.pdf`.
- Overlays: `http://127.0.0.1:5173/scripts/overlay-preview.html?state=tooltip`; states also include long, pinned, ocr, input and input-error.
- The dev-only extension API shim uses session storage. It is excluded from the production bundle; live provider/OCR responses are not simulated as successful translations.
- Browser checks: `HALLMARK_PUPPETEER=<directory containing puppeteer-core> node scripts/check-ui.mjs`. The temporary verifier for this run lives in ignored `.hallmark/runtime`.
- Before/after comparison: `.hallmark/compare.html`.
- Production extension: `dist/`. Reload it in Chrome and reload host tabs for the new content script and manifest.

## Existing state gaps and material

Settings load/save failures still use the existing console reporting; no new storage recovery behavior was introduced. The existing PDF password resolver does not open its password UI automatically, so the retained dialog was inspected as a visual state.

No image slots or stand-in photographs are used. The development reader examples and one-page PDF are fixtures, not product claims. A vector brand mark could replace the existing translation icon later; no new material is needed to use this redesign.
