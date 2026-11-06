Status: done

# Issue 01: Learning Account and Account Link

## What to build

Create the companion website in its own root-level `web/` directory with a Vue + TypeScript frontend, Tailwind CSS, and a FastAPI backend whose Python code has type annotations. A learner can create a Learning Account, sign in and out, and initiate an Account Link from extension settings. The extension shows whether it is linked and can disconnect; the website and API keep each learner's data private. Use the `ui-ux-pro-max` skill to research and establish a bright, modern, moderately colorful design direction that later slices can follow.

## Acceptance criteria

- [x] A learner can register, sign in, sign out, link the extension from its settings, and see the linked account state without exposing credentials in page content.
- [x] A second account cannot read or act on the first account's authenticated data; expired or revoked links fail safely.
- [x] The website has a responsive light visual foundation researched with `ui-ux-pro-max`, with keyboard-accessible authentication and clear loading and error states.
- [x] Frontend code is TypeScript, backend Python is type annotated, and meaningful tests verify account isolation and the link flow.

## Blocked by

None - can start immediately

## Comments

- Implemented in `web/` and extension popup/background. Verified API tests, Vue UI tests, extension link tests, web/extension builds, and browser login/logout at desktop and mobile widths.
