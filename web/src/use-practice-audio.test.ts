// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { usePracticeAudio } from './use-practice-audio';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('an unpopulated voice list still allows a Mandarin sample in the click handler', () => {
  vi.useFakeTimers();
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  const speak = vi.fn();
  const getVoices = vi.fn(() => [] as SpeechSynthesisVoice[]);
  vi.stubGlobal('speechSynthesis', { getVoices, cancel: vi.fn(), speak });
  const audio = usePracticeAudio();

  audio.playSample('终于');

  expect(speak).toHaveBeenCalledOnce();
  expect(speak.mock.calls[0]![0]).toMatchObject({ text: '终于', lang: 'zh-CN' });
  expect(audio.sampleError.value).toBe('');

  // The next tap rechecks the list after iOS has finished loading voices.
  const voice = { lang: 'zh-CN', name: 'Mandarin' } as SpeechSynthesisVoice;
  getVoices.mockReturnValue([voice]);
  audio.playSample('工作');
  expect(speak.mock.calls[1]![0].voice).toBe(voice);
  audio.clearRecordings();
});

test('a real missing Mandarin voice gives iPhone installation instructions', () => {
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => [{ lang: 'en-US', name: 'English' }], cancel: vi.fn(), speak: vi.fn(),
  });
  const audio = usePracticeAudio();
  audio.playSample('终于');
  expect(audio.sampleError.value).toContain('Cài đặt → Trợ năng');
  expect(audio.sampleError.value).toContain('Mandarin');
});

test('a Mandarin language error after an initially empty list explains how to install a voice', () => {
  vi.useFakeTimers();
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => [], cancel: vi.fn(),
    speak: (utterance: SpeechSynthesisUtterance) => {
      utterance.onerror?.({ error: 'language-unavailable' } as SpeechSynthesisErrorEvent);
    },
  });
  const audio = usePracticeAudio();
  audio.playSample('终于');
  expect(audio.samplePlaying.value).toBe(false);
  expect(audio.sampleError.value).toContain('Mandarin');
  vi.advanceTimersByTime(5000);
  expect(audio.sampleError.value).toContain('Mandarin');
  audio.clearRecordings();
});
