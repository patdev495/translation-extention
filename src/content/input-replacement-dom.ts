import {
  type InputReplacementAdapter,
  type InputReplacementSelection,
  type InputTranslationStatus,
} from './input-replacement';

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'tel']);

function dispatchInput(element: HTMLElement, text: string): void {
  try {
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text,
    }));
  } catch {
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function sameRange(left: Range, right: Range): boolean {
  return left.startContainer === right.startContainer
    && left.startOffset === right.startOffset
    && left.endContainer === right.endContainer
    && left.endOffset === right.endOffset;
}

function insertIntoContentEditable(root: HTMLElement, range: Range, translation: string): void {
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  root.focus();

  if (document.execCommand?.('insertText', false, translation)) return;

  range.deleteContents();
  const text = document.createTextNode(translation);
  range.insertNode(text);
  range.setStartAfter(text);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
  dispatchInput(root, translation);
}

function insertIntoInput(
  element: HTMLInputElement | HTMLTextAreaElement,
  start: number,
  end: number,
  translation: string,
): void {
  element.focus();
  element.setSelectionRange(start, end);
  if (document.execCommand?.('insertText', false, translation)) return;

  element.setRangeText(translation, start, end, 'end');
  dispatchInput(element, translation);
}

function getContentEditableRoot(target: Element | null): HTMLElement | null {
  if (!target) return null;
  const root = target.closest<HTMLElement>('[contenteditable]:not([contenteditable="false"])');
  return root?.isContentEditable ? root : null;
}

function captureInputSelection(element: HTMLInputElement | HTMLTextAreaElement): InputReplacementSelection | null {
  if (element.disabled || element.readOnly) return null;
  const start = element.selectionStart;
  const end = element.selectionEnd;
  if (start === null || end === null || start === end) return null;
  const text = element.value.slice(start, end);
  if (!text) return null;

  return {
    text,
    isCurrent: () => document.activeElement === element
      && element.selectionStart === start
      && element.selectionEnd === end
      && element.value.slice(start, end) === text,
    replace: (translation) => insertIntoInput(element, start, end, translation),
  };
}

function captureContentEditableSelection(root: HTMLElement): InputReplacementSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const text = range.toString();
  if (!text) return null;
  const snapshot = range.cloneRange();

  return {
    text,
    isCurrent: () => {
      const current = window.getSelection();
      return document.activeElement === root
        && !!current
        && current.rangeCount === 1
        && sameRange(snapshot, current.getRangeAt(0))
        && current.toString() === text;
    },
    replace: (translation) => insertIntoContentEditable(root, snapshot, translation),
  };
}

/** Captures selections only from editable fields that are safe to translate. */
export function captureEligibleInputSelection(): InputReplacementSelection | null {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(active.type.toLowerCase()) ? captureInputSelection(active) : null;
  }
  if (active instanceof HTMLTextAreaElement) return captureInputSelection(active);
  if (active instanceof HTMLElement) {
    const root = getContentEditableRoot(active);
    return root ? captureContentEditableSelection(root) : null;
  }
  return null;
}

function createStatus(): InputTranslationStatus {
  const active = document.activeElement as HTMLElement | null;
  const rect = active?.getBoundingClientRect();
  const indicator = document.createElement('div');
  indicator.textContent = 'Đang dịch…';
  indicator.setAttribute('role', 'status');
  Object.assign(indicator.style, {
    position: 'fixed',
    top: `${(rect?.bottom ?? 12) + 6}px`,
    left: `${rect?.left ?? 12}px`,
    zIndex: '2147483647',
    padding: '4px 8px',
    borderRadius: '6px',
    background: '#0f766e',
    color: '#fff',
    font: '12px system-ui, sans-serif',
    pointerEvents: 'none',
  });
  document.body.appendChild(indicator);

  return {
    hide: () => indicator.remove(),
    error: (message) => {
      indicator.textContent = message || 'Dịch thất bại.';
      indicator.style.background = '#b91c1c';
      window.setTimeout(() => indicator.remove(), 3000);
    },
  };
}

export function createInputReplacementAdapter(): InputReplacementAdapter {
  return {
    captureSelection: captureEligibleInputSelection,
    translate: async (text) => {
      const response = await chrome.runtime.sendMessage({ type: 'TRANSLATE_DIRECT_PRIMARY', text });
      if (!response?.success) throw new Error(response?.error || 'Dịch thất bại.');
      return response.data.translation;
    },
    showStatus: () => createStatus(),
  };
}
