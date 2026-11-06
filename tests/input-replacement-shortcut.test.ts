import { describe, expect, test } from 'vitest';
import {
  InputReplacementShortcutTracker,
  matchesShortcut,
  shortcutConflictsWithOcr,
} from '../src/content/input-replacement-shortcut';

function keyEvent(code: string, options: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return { code, key: code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...options } as KeyboardEvent;
}

describe('Input Replacement Shortcut', () => {
  test('triggers after tapping the left Control key without another key', () => {
    const tracker = new InputReplacementShortcutTracker('ControlLeft');

    expect(tracker.handleKeyDown(keyEvent('ControlLeft'))).toBe(false);
    expect(tracker.handleKeyUp(keyEvent('ControlLeft'))).toBe(true);
  });

  test('does not trigger when the left Control key is used in a chord', () => {
    const tracker = new InputReplacementShortcutTracker('ControlLeft');

    tracker.handleKeyDown(keyEvent('ControlLeft'));
    tracker.handleKeyDown(keyEvent('KeyC', { ctrlKey: true }));

    expect(tracker.handleKeyUp(keyEvent('ControlLeft'))).toBe(false);
  });

  test('matches an exact custom keyboard chord', () => {
    expect(matchesShortcut('Ctrl+Shift+KeyQ', keyEvent('KeyQ', { ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(matchesShortcut('Ctrl+Shift+KeyQ', keyEvent('KeyQ', { ctrlKey: true }))).toBe(false);
  });

  test('rejects a shortcut that exactly matches OCR', () => {
    expect(shortcutConflictsWithOcr('Ctrl+Space', 'ctrl-space')).toBe(true);
    expect(shortcutConflictsWithOcr('ControlLeft', 'ctrl-space')).toBe(false);
  });
});
