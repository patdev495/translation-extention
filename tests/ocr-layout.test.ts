import { describe, expect, test } from 'vitest';
import { assembleOcrLayoutText } from '../src/services/ocr-layout';

describe('assembleOcrLayoutText', () => {
  test('preserves visual line breaks and reading order from OCR boxes', () => {
    const text = assembleOcrLayoutText([
      { text: 'line two right', box: { x: 180, y: 50, height: 20 } },
      { text: 'line one', box: { x: 10, y: 10, height: 20 } },
      { text: 'line two left', box: { x: 10, y: 52, height: 20 } },
      { text: 'line three', box: { x: 10, y: 92, height: 20 } },
    ]);

    expect(text).toBe('line one\nline two left line two right\nline three');
  });

  test('ignores empty OCR boxes when assembling layout', () => {
    const text = assembleOcrLayoutText([
      { text: 'first', box: { x: 10, y: 10, height: 20 } },
      { text: '   ', box: { x: 80, y: 10, height: 20 } },
      { text: 'second', box: { x: 10, y: 45, height: 20 } },
    ]);

    expect(text).toBe('first\nsecond');
  });
});
