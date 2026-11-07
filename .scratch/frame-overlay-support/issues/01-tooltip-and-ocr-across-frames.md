# Translation Tooltip and OCR across frames

Status: ready-for-agent

Baseline: `f6314f5` — current code snapshot before implementation.

## Problem Statement

The reported Domino workflow page uses a top-level frameset: a 98px header, followed by an 18% left navigation frame and an 82% content frame. A Translation Tooltip opened in the left navigation is clipped at that frame's boundary. OCR Selection Mode cannot reliably select across that boundary.

Current code injects the content script into all matching frames, creates a Translation Tooltip in each document, and mounts both tooltip and webpage OCR hosts on the current document body. On a frameset document, that body is the frameset itself. OCR sends frame-local coordinates and frame viewport dimensions, while the background captures the whole tab. The crop therefore also uses the wrong coordinate space when invoked from a child frame. These code paths and the supplied HTML establish the architectural gaps; the exact visual repair still needs verification in Chrome.

## Solution

Keep text selection and editable-field handling in the originating document. Route display requests to one top-level presentation owner per tab. Run webpage OCR Selection Mode in that same owner so the Image Region and screenshot crop share the tab viewport coordinate space.

Provide a shared overlay mounting facility for ordinary documents and legacy frameset documents. Verify a manual popover/top-layer host mounted outside the frameset before adopting it; ordinary z-index inside a child frame cannot escape its viewport. Do not replace the site's frameset or move its frames. Maintain Shadow DOM Isolation, transparent pointer behavior outside cards, and the existing PDF viewer path.

## Commits

### 1. Add a real-browser reproduction and mounting proof

- Add local fixtures matching the supplied nested frameset geometry, plus an ordinary iframe page. Serve fixture content on two local origins for cross-origin coverage.
- Reproduce tooltip clipping, OCR selection confinement, and incorrect crop coordinates against the baseline extension in Chrome.
- Determine whether frameset overflow contributes beyond child-frame clipping; do not assume appending a div to a frameset renders normally.
- Prove the proposed top-level host renders over all three frames without changing their layout, supports clicks on cards, and lets clicks outside cards reach the site.
- Record the Chrome version and the result. Resolve the host strategy here before migrating production UI.
- Add browser checks through a minimal harness with stub translation/OCR responses; include a real extension capture check for crop alignment.

### 2. Introduce a shared presentation host

- Add host creation and teardown for ordinary documents and frameset documents, with a supported fallback if top-layer mounting is unavailable.
- Preserve current tooltip coordinates and pointer behavior on normal pages. Explicitly reset popover defaults, margins, backdrop, and positioning if using the popover API.
- Move the Translation Tooltip and Hanzi Breakdown Tooltip to this facility. Confirm dragging, focus, scrolling, selection, saving, and TTS still work.
- Ensure OCR can temporarily hide or pass through existing cards; host lifetime must not depend on one translation result.
- Validate frameset mounting using the fixture and keep normal-page regression tests passing.

### 3. Route child-frame translation to the top-level owner

- Add typed, validated messages for translation display, dismissal, and OCR toggle requests. Relay tab-local requests through the extension runtime, targeting frame zero explicitly.
- Preserve browser-supplied sender identity; do not trust tab/frame identifiers supplied in message data. Do not expose extension-privileged operations to arbitrary page postMessage payloads.
- Define how nested-frame anchor rectangles reach the top viewport. Use a verified geometry handshake across immediate parent frame boundaries where direct DOM access is unavailable; match each child window to its frame element and account for borders, scrolling, and axis-aligned scaling.
- Keep geometry exchange separate from privileged translation requests. Bound timeouts and reject unverified or stale geometry. For unsupported transforms or unavailable geometry, show the result at a defined safe top-level location rather than silently using wrong coordinates.
- Let child documents retain selection listeners and input replacement behavior, while only the top owner presents floating translation UI.
- Use request IDs/generations so an older result, frame navigation, or a delayed dismissal cannot replace or close a newer translation.
- Route child-frame outside clicks to dismissal; keep interaction within tooltip and breakdown cards intact. Avoid duplicate triggers or duplicate translation requests.

### 4. Run webpage OCR in top viewport coordinates

- Forward OCR shortcuts from any eligible frame to the top owner; leave the extension PDF viewer's canvas OCR flow intact.
- Mount one full-viewport OCR overlay above the complete frameset. Support a drag spanning the left and right frames and the header.
- Select, position progress, crop, and place the resulting Translation Tooltip using an explicit top-viewport coordinate contract. Convert to document coordinates only where the tooltip API requires it.
- Capture the sender's tab/window deliberately. Confirm the captured tab is still active in that window; cancel with a clear status if it changed rather than capturing a different tab. Check that the capture request originates from the top owner.
- Hide capture-visible extension UI before repaint/capture and restore it after completion or cancellation. Prevent the progress indicator, existing tooltip, or pinned cards from contaminating the crop.
- Target progress and results to the owning tab/frame/request instead of whichever tab is active when progress arrives.
- Use stable event listener references and remove them on every stop path; the current shadow overlay mouseup listener also needs this cleanup.
- Initialize synced Pinned Snippet Panels only in the presentation owner on webpages, avoiding a duplicate panel in every child frame. Verify OCR pin/copy settings and cancel/retry behavior.

### 5. Complete regression coverage and delivery notes

- Cover frame reload/removal, changed frame sizes, navigation during translation, repeat OCR toggle, Escape, and late OCR progress/results.
- Assess related-frame injection options for about:blank/srcdoc frames; enable only the options needed by tested cases and document inaccessible browser pages as unsupported.
- Run the targeted behavior tests, the existing test suite, and the production build. Run browser checks against the built extension, not just DOM stubs.
- Record any unresolved browser limitations and manual verification steps for the original internal site.

## Decision Document

- One presentation owner per tab; document-local event detection remains distributed across matching frames.
- The background routes privileged requests using verified runtime sender information. Frame-zero routing avoids cross-origin DOM dependencies for translation and OCR activation.
- Translation anchors require frame geometry conversion; OCR avoids conversion by selecting directly in the top viewport.
- Frameset host behavior must be proven in a real browser before the final mounting implementation is chosen. Top-level ownership alone does not prove frameset rendering works.
- Shadow DOM continues to isolate styles. A full-viewport host passes through input except during OCR Selection Mode or interaction with a visible card.
- Settings, consent, translation providers, and browser-local OCR models retain their existing semantics.
- Public behavior and message contracts matter more than any particular internal module layout. No new host permission is planned unless browser evidence establishes a requirement.

## Testing Decisions

- Test visible behavior and actual captured image regions. A z-index assertion or a mocked appendChild cannot establish that an overlay escapes frame clipping.
- Use current tooltip, OCR overlay, and pinned-panel unit tests as prior art; extend them for state transitions, request races, geometry, and cleanup.
- Browser fixture matrix: normal page, supplied-style legacy frameset, same-origin iframe, nested frames, and cross-origin frames. Include a blank/srcdoc child when evaluating injection coverage.
- Assert tooltip visibility/hit testing beyond the 18% frame boundary and across the header boundary. Assert underlying controls remain clickable outside visible cards.
- Select a known colored/text rectangle spanning frames and verify the actual crop against its known location. Include scroll offsets, browser zoom/DPR, frame borders, and frame resize cases.
- Stub model/provider results for deterministic interaction tests, then perform one real capture-to-OCR smoke check on known text. Do not repeatedly download/retest model accuracy for this UI change.
- Verify normal translation, Hanzi breakdown, editable-field replacement, pinned images, and PDF OCR retain their behavior.
- Baseline snapshot and this plan do not claim tests passed: implementation and browser verification have not started.

## Acceptance Criteria

- Selecting text in leftBottom shows one fully accessible Translation Tooltip that can extend over NotesView.
- OCR invoked from any supported frame can select an Image Region anywhere in the visible tab, including across frame boundaries, and crops the intended pixels.
- Progress, cancellation, results, and pinned cards remain associated with the correct request and tab.
- Frames keep their original layout and navigation; normal-page and PDF behavior pass regression checks.

## Out of Scope

- Altering the internal workflow website, translation providers, OCR model accuracy, or learning-library data.
- Browser-restricted pages where extension content scripts cannot run.
- Full support for arbitrary rotated or perspective-transformed embedded frames; document fallback placement for those anchors.

## Further Notes

The checkpoint includes source, local skills, OCR experiments/models, and store assets. Local process metadata, the nested worktree, and the local SQLite database were left outside the commit.

## Comments

- User requested a checkpoint commit followed by a repair plan. This issue records the plan only; no extension behavior has been changed.
