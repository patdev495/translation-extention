import { describe, expect, test } from 'vitest';
import { normalizeLatinOcrText } from '../src/services/ocr-postprocess';

describe('normalizeLatinOcrText', () => {
  test('corrects VietOCR confusion for standalone AI acronyms', () => {
    expect(normalizeLatinOcrText('Hoc Al, nghien cuu, fine-tune, chay LLM')).toBe(
      'Hoc AI, nghien cuu, fine-tune, chay LLM'
    );
  });

  test('does not change Al inside longer words', () => {
    expect(normalizeLatinOcrText('Algorithm Alpine Al')).toBe('Algorithm Alpine AI');
  });
});
