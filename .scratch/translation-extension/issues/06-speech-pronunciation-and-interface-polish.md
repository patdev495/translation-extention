Status: ready-for-agent

# Issue 06: Speech Pronunciation (TTS) & Interface Polish

Polish the tooltip UI with glassmorphism styles, add TTS buttons, and support hotkeys and Auto/Icon modes.

## Parent

- [.scratch/translation-extension/PRD.md](file:///d:/Workspace/translation-extention/.scratch/translation-extension/PRD.md)

## What to build

1. **TTS Integration**: Implement a speaker button in the Tooltip UI that triggers `window.speechSynthesis` to speak the source text using the correct locale voice (English or Chinese).
2. **Glassmorphism Design**: Style the Tooltip using **Tailwind CSS v4** utility classes to achieve glassmorphism effects (e.g., `backdrop-blur-*`, semi-transparent backgrounds and borders, transitions, and dark/light mode responsive classes).
3. **Trigger Modes**:
   - **Auto Mode**: Show the Tooltip immediately on `mouseup` after selecting text.
   - **Icon Mode**: Show a small trigger button near the selection first. Show the full Tooltip only when clicking that button.
4. **Hotkeys**: Read the hotkey configuration from settings. Check if the hotkey modifier (Ctrl/Alt/Shift) is held down during selection before showing the icon or tooltip.
5. **Quick-Switch Dropdowns**: Add dropdown selectors inside the Tooltip UI to change target languages on the fly.

## Acceptance criteria

- [ ] TTS button plays natural sounding audio in the correct language when clicked.
- [ ] Tooltip UI exhibits modern glassmorphism aesthetics and matches dark/light mode themes using Tailwind CSS v4.

- [ ] Auto Mode vs Icon Mode triggers correctly according to settings.
- [ ] Hotkeys settings successfully gate text selection triggering.
- [ ] Users can change the translation target language using the quick-switch dropdown in the tooltip.

## Blocked by

- [05-basic-tooltip-and-selection-event.md](file:///d:/Workspace/translation-extention/.scratch/translation-extension/issues/05-basic-tooltip-and-selection-event.md)
