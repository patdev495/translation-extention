# Browser regression checks

Run `npm run test:browser` from the repository root. It builds the extension and launches a fresh, temporary Chromium profile with that extension installed. Install the browser once with `npx playwright install chromium` if needed.

Run the unit/package suite and the browser suite sequentially: packaging tests also rebuild `dist`, which must not be modified while a browser is using it. After building, `npx playwright test` reruns only the browser checks.

The local HTTP fixtures reproduce the supplied Domino layout (98px header and 18%/82% columns), regular/nested iframes, separate origins, srcdoc, and a non-secure HTTP intranet hostname. The tests interact with the built extension. Translation network responses and OCR recognition responses are replaced at their external boundaries; content scripts, background routing, browser tab capture, screenshot cropping, UI events, and the PDF viewer run normally.

One opt-in check uses the actual packaged PP-OCRv6 tiny model. In PowerShell:

```powershell
$env:RUN_REAL_OCR = '1'
npx playwright test -g 'real model OCR'
Remove-Item Env:RUN_REAL_OCR
```

This check recognizes a known HELLO WORLD image region and displays its Source Text through the Translation Tooltip. The translation provider remains deterministic. Other browser checks verify exact crop pixels without depending on model recognition accuracy.

Failure artifacts and the frameset tooltip screenshot are written under `test-results/`. The temporary browser profile is removed after the run. No production browser profile or internal website credentials are used.
