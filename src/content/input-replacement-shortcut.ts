export type InputReplacementShortcut = string | 'disabled';

const MODIFIER_CODES = new Set([
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
  'ShiftRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
]);

const OCR_SHORTCUTS: Record<string, string | undefined> = {
  'ctrl-space': 'Ctrl+Space',
  'alt-o': 'Alt+KeyO',
  'ctrl-shift-o': 'Ctrl+Shift+KeyO',
};

function modifierParts(event: KeyboardEvent): string[] {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  return parts;
}

function isModifierOnlyShortcut(shortcut: InputReplacementShortcut): boolean {
  return shortcut !== 'disabled' && MODIFIER_CODES.has(shortcut);
}

/** Converts a captured key event into the persistent shortcut representation. */
export function shortcutFromKeyboardEvent(event: KeyboardEvent): InputReplacementShortcut {
  if (MODIFIER_CODES.has(event.code)) return event.code;
  return [...modifierParts(event), event.code].join('+');
}

/** Matches non-modifier keyboard shortcuts on keydown. Modifier-only shortcuts use the tracker. */
export function matchesShortcut(shortcut: InputReplacementShortcut, event: KeyboardEvent): boolean {
  if (shortcut === 'disabled' || isModifierOnlyShortcut(shortcut)) return false;

  const parts = shortcut.split('+');
  const code = parts.pop();
  if (code !== event.code) return false;

  const expected = new Set(parts);
  return event.ctrlKey === expected.has('Ctrl')
    && event.altKey === expected.has('Alt')
    && event.shiftKey === expected.has('Shift')
    && event.metaKey === expected.has('Meta');
}

export function shortcutConflictsWithOcr(
  shortcut: InputReplacementShortcut,
  ocrShortcut: string,
): boolean {
  return shortcut !== 'disabled' && shortcut === OCR_SHORTCUTS[ocrShortcut];
}

/** Tracks modifier-only shortcuts so Ctrl+C/V/A does not trigger a translation. */
export class InputReplacementShortcutTracker {
  private trackingModifierTap = false;
  private usedWithAnotherKey = false;

  constructor(private readonly shortcut: InputReplacementShortcut) {}

  handleKeyDown(event: KeyboardEvent): boolean {
    if (this.shortcut === 'disabled') return false;

    if (isModifierOnlyShortcut(this.shortcut)) {
      if (event.code === this.shortcut) {
        this.trackingModifierTap = true;
        this.usedWithAnotherKey = false;
        return false;
      }
      if (this.trackingModifierTap) this.usedWithAnotherKey = true;
      return false;
    }

    return matchesShortcut(this.shortcut, event);
  }

  handleKeyUp(event: KeyboardEvent): boolean {
    if (!isModifierOnlyShortcut(this.shortcut) || event.code !== this.shortcut) return false;
    const shouldTrigger = this.trackingModifierTap && !this.usedWithAnotherKey;
    this.trackingModifierTap = false;
    this.usedWithAnotherKey = false;
    return shouldTrigger;
  }
}
