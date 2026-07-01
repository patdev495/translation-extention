Status: ready-for-agent

# Issue 07: Toolbar Extension Settings Popup UI

Implement the settings configuration UI when clicking the extension icon in the toolbar.

## Parent

- [.scratch/translation-extension/PRD.md](file:///d:/Workspace/translation-extention/.scratch/translation-extension/PRD.md)

## What to build

1. Implement the Extension Action Popup UI in HTML, TypeScript, and styled with **Tailwind CSS v4** utility classes.
2. The UI must display:
   - A toggle to quickly turn the extension on or off.
   - Dropdown selectors to configure `Primary Target Language` and `Secondary Target Language`.
   - Settings for `Trigger Mode` (Auto vs Icon) and `Hotkey` modifiers (None, Ctrl, Alt, Shift).
   - A toggle to enable/disable TTS.
3. Automatically load current settings from `SettingsManager` when the popup opens.
4. Save any setting changes back to `SettingsManager` instantly upon modification, notifying active tabs of configuration updates.

## Acceptance criteria

- [ ] Extension action popup matches glassmorphism design language using Tailwind CSS v4.

- [ ] Changing settings in the popup writes to `chrome.storage.local` correctly and updates extension behavior immediately without reloading pages.
- [ ] Toggling the extension "off" completely disables selection monitoring on active webpages.

## Blocked by

- [06-speech-pronunciation-and-interface-polish.md](file:///d:/Workspace/translation-extention/.scratch/translation-extension/issues/06-speech-pronunciation-and-interface-polish.md)
