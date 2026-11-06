import { describe, expect, test, vi } from 'vitest';
import {
  InputReplacementController,
  type InputReplacementAdapter,
  type InputReplacementSelection,
} from '../src/content/input-replacement';

function createAdapter(selection: InputReplacementSelection | null): InputReplacementAdapter {
  return {
    captureSelection: vi.fn(() => selection),
    translate: vi.fn(async () => 'Xin chào'),
    showStatus: vi.fn(() => ({ hide: vi.fn(), error: vi.fn() })),
  };
}

describe('InputReplacementController', () => {
  test('does nothing when there is no Eligible Input Selection', async () => {
    const adapter = createAdapter(null);

    await new InputReplacementController(adapter).translateSelection();

    expect(adapter.translate).not.toHaveBeenCalled();
    expect(adapter.showStatus).not.toHaveBeenCalled();
  });

  test('discards a Stale Input Translation', async () => {
    const replace = vi.fn();
    const adapter = createAdapter({ text: 'hello', isCurrent: () => false, replace });

    await new InputReplacementController(adapter).translateSelection();

    expect(replace).not.toHaveBeenCalled();
  });

  test('replaces a current selection with the Direct Primary Translation', async () => {
    const replace = vi.fn();
    const adapter = createAdapter({ text: 'hello', isCurrent: () => true, replace });

    await new InputReplacementController(adapter).translateSelection();

    expect(replace).toHaveBeenCalledWith('Xin chào');
  });
});
