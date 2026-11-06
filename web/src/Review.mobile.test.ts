// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Review from './Review.vue';

let page: VueWrapper | undefined;
const word = { id: 'word', folder_id: 'folder', category: 'word', text: '终于', meaning: 'cuối cùng', pinyin: 'zhōng yú', created_at: 1, linked_item_ids: [] };
const sentence = { ...word, id: 'sentence', category: 'sentence', text: '我终于找到工作了。', meaning: 'Cuối cùng tôi đã tìm được việc.', pinyin: 'wǒ zhōng yú zhǎo dào gōng zuò le' };

function serveReview() {
  const results: Record<string, string> = {};
  let started = false;
  const session = { id: 'practice', kind: 'vocabulary', position: 0, completed: false,
    settings: { folder_id: null, category: 'all', practice: 'classic', prompt_mode: 'meaning', autoplay: true },
    questions: [word, sentence].map(item => ({ sentence: null, item_ids: [item.id], items: [item] })), ineligible_count: 0, results };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    if (url === '/api/review/overview') return Response.json({ entries: [], totals: {
      remembered: Object.values(results).filter(result => result === 'remembered').length,
      not_yet: Object.values(results).filter(result => result === 'not_yet').length,
    } });
    if (url === '/api/review/sessions/current') return Response.json(started && !session.completed ? session : null);
    if (url === '/api/review/sessions/practice') return Response.json(session);
    if (url === '/api/review/sessions' && init?.method === 'POST') {
      started = true;
      Object.assign(session.settings, body);
      session.questions = [word, sentence].filter(item => body.category === 'all' || !body.category || item.category === body.category)
        .map(item => ({ sentence: null, item_ids: [item.id], items: [item] }));
      return Response.json(session, { status: 201 });
    }
    if (url.startsWith('/api/review/sessions/practice/results/')) {
      const id = url.split('/').at(-1)!;
      results[id] = body.result;
      if (typeof body.position === 'number') session.position = body.position;
      session.completed = session.position === session.questions.length;
      return Response.json({ item_id: id, result: body.result });
    }
    if (url === '/api/review/sessions/practice/progress') {
      session.position = body.position;
      session.completed = session.position === session.questions.length;
      for (const key of ['practice', 'prompt_mode', 'autoplay'] as const) {
        if (key in body) Object.assign(session.settings, { [key]: body[key] });
      }
      return Response.json(session);
    }
    return Response.json({ detail: 'Unexpected test HTTP request' }, { status: 404 });
  }));
  return session;
}

function allowMicrophone() {
  const released = vi.fn();
  const played: string[] = [];
  const revoked: string[] = [];
  let take = 0;
  vi.stubGlobal('MediaRecorder', class extends EventTarget {
    static isTypeSupported = (type: string) => type === 'audio/mp4';
    state = 'inactive';
    mimeType = 'audio/mp4';
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      queueMicrotask(() => {
        this.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['recording'], { type: 'audio/mp4' }) }));
        this.dispatchEvent(new Event('stop'));
      });
    }
  });
  vi.stubGlobal('navigator', { userAgent: navigator.userAgent, mediaDevices: {
    getUserMedia: vi.fn(async () => {
      const track = { readyState: 'live', stop: () => { track.readyState = 'ended'; released(); } };
      return { getTracks: () => [track] };
    }),
  } });
  vi.stubGlobal('Audio', class {
    constructor(public src: string) {}
    play() { played.push(this.src); return Promise.resolve(); }
    pause() {}
    addEventListener() {}
  });
  const BrowserURL = URL;
  vi.stubGlobal('URL', class extends BrowserURL {
    static createObjectURL() { return `blob:take-${++take}`; }
    static revokeObjectURL(url: string) { revoked.push(url); }
  });
  return { played, revoked, released };
}

beforeEach(() => {
  localStorage.clear();
  window.getSelection()?.removeAllRanges();
});
afterEach(() => {
  page?.unmount();
  page = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('moving between flashcards does not assess them; only explicit recall buttons record a result', async () => {
  serveReview();
  page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Tiếp"]').trigger('click');
  await flushPromises();
  expect(page.get('.review-statistics').text()).toContain('Đã nhớ 0');
  await page.get('button[aria-label="Chưa nhớ"]').trigger('click');
  await flushPromises();
  expect(page.get('.review-summary').text()).toContain('Đã nhớ: 0 · Chưa nhớ: 1');
  await page.get('button[aria-label="Lùi"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Nhớ"]').trigger('click');
  await flushPromises();
  expect(page.get('.review-summary').text()).toContain('Đã nhớ: 1 · Chưa nhớ: 0');
});

test('learner chooses saved sentences and a practice style while keeping ordinary flashcard prompt modes', async () => {
  serveReview();
  page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('select[aria-label="Nội dung luyện"]').setValue('sentence');
  await page.get('select[aria-label="Cách luyện"]').setValue('speak');
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  expect(page.get('.review-front').text()).toBe('Cuối cùng tôi đã tìm được việc.');
  expect(page.get('.review-question').text()).toContain('1 / 1');
  await page.get('select[aria-label="Cách luyện"]').setValue('classic');
  await page.get('select[aria-label="Mặt trước flashcard"]').setValue('pinyin');
  expect(page.get('.review-front').text()).toBe('wǒ zhōng yú zhǎo dào gōng zuò le');
  await page.get('select[aria-label="Cách luyện"]').setValue('listen');
  expect(page.get('.review-front').text()).not.toContain('我');
  page.unmount();
  page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  expect((page.get('select[aria-label="Cách luyện"]').element as HTMLSelectElement).value).toBe('listen');
});

test('only listening practice auto-plays Chinese audio and its preference can be turned off', async () => {
  serveReview();
  const spoken: string[] = [];
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => [{ lang: 'zh-CN', name: 'Chinese' }], cancel: vi.fn(),
    speak: (utterance: SpeechSynthesisUtterance) => { spoken.push(utterance.text); utterance.onend?.(new Event('end') as SpeechSynthesisEvent); },
  });
  page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('select[aria-label="Cách luyện"]').setValue('listen');
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  expect(spoken).toEqual(['终于']);
  await page.get('input[aria-label="Tự phát mẫu"]').setValue(false);
  await page.get('button[aria-label="Tiếp"]').trigger('click');
  await flushPromises();
  expect(spoken).toEqual(['终于']);
  await page.get('select[aria-label="Cách luyện"]').setValue('speak');
  expect(spoken).toEqual(['终于']);
  await page.get('button[aria-label="Nghe mẫu"]').trigger('click');
  expect(spoken).toEqual(['终于', '我终于找到工作了。']);
  expect(page.get('[aria-label="Lật thẻ"]').attributes('aria-pressed')).toBe('false');
  await page.get('[aria-label="Lật thẻ"]').trigger('click');
  expect(page.get('.review-back').text()).toContain('我终于找到工作了。');
});

test('temporary recordings belong to their card, are replaced by a new take and stop when the page is hidden', async () => {
  serveReview();
  const microphone = allowMicrophone();
  page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Thu âm"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Dừng thu âm"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Nghe bản thu"]').trigger('click');
  expect(microphone.played).toEqual(['blob:take-1']);
  await page.get('button[aria-label="Tiếp"]').trigger('click');
  await flushPromises();
  expect(page.get('button[aria-label="Nghe bản thu"]').attributes('disabled')).toBeDefined();
  await page.get('button[aria-label="Lùi"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Nghe bản thu"]').trigger('click');
  expect(microphone.played).toEqual(['blob:take-1', 'blob:take-1']);
  await page.get('button[aria-label="Thu âm"]').trigger('click');
  await flushPromises();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
  await flushPromises();
  expect(microphone.released).toHaveBeenCalledTimes(2);
  expect(microphone.revoked).toContain('blob:take-1');
  await page.get('button[aria-label="Nghe bản thu"]').trigger('click');
  expect(microphone.played.at(-1)).toBe('blob:take-2');
  page.unmount();
  page = undefined;
  expect(microphone.revoked).toContain('blob:take-2');
});

test('practice resumes the same unfinished card and assessments after reopening, without restoring recordings', async () => {
  serveReview();
  allowMicrophone();
  page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Chưa nhớ"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Thu âm"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Dừng thu âm"]').trigger('click');
  await flushPromises();
  expect(page.get('button[aria-label="Nghe bản thu"]').attributes('disabled')).toBeUndefined();
  page.unmount();
  page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Tiếp tục bài dở"]').trigger('click');
  await flushPromises();
  expect(page.get('.review-question').text()).toContain('2 / 2');
  expect(page.get('.review-front').text()).toBe('Cuối cùng tôi đã tìm được việc.');
  expect(page.get('.review-statistics').text()).toContain('Chưa nhớ 1');
  expect(page.get('button[aria-label="Nghe bản thu"]').attributes('disabled')).toBeDefined();
  await page.get('button[aria-label="Tiếp"]').trigger('click');
  await flushPromises();
  expect(page.get('.review-summary').text()).toContain('Đã nhớ: 0 · Chưa nhớ: 1');
});

test('denied microphone permission and a missing Mandarin voice leave flashcards usable', async () => {
  serveReview();
  allowMicrophone();
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  vi.stubGlobal('speechSynthesis', { getVoices: () => [{ lang: 'zh-HK', name: 'Cantonese' }], cancel: vi.fn(), speak: vi.fn() });
  page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Thu âm"]').trigger('click');
  await flushPromises();
  expect(page.text()).toContain('Chưa được cấp quyền micro');
  await page.get('button[aria-label="Nghe mẫu"]').trigger('click');
  expect(page.text()).toContain('Chưa có giọng đọc tiếng Trung');
  await page.get('[aria-label="Lật thẻ"]').trigger('click');
  expect(page.get('[aria-label="Lật thẻ"]').attributes('aria-pressed')).toBe('true');
  await page.get('button[aria-label="Tiếp"]').trigger('click');
  await flushPromises();
  expect(page.get('.review-question').text()).toContain('2 / 2');
});

test('a late microphone permission response cannot start recording on a different card', async () => {
  serveReview();
  allowMicrophone();
  let grant!: (stream: MediaStream) => void;
  vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(() => new Promise(resolve => { grant = resolve; }));
  page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Thu âm"]').trigger('click');
  await page.get('button[aria-label="Tiếp"]').trigger('click');
  await flushPromises();
  const release = vi.fn();
  grant({ getTracks: () => [{ stop: release }] } as unknown as MediaStream);
  await flushPromises();
  expect(release).toHaveBeenCalledOnce();
  expect(page.get('button[aria-label="Thu âm"]').attributes('disabled')).toBeUndefined();
  expect(page.get('button[aria-label="Nghe bản thu"]').attributes('disabled')).toBeDefined();
});

test('failed navigation keeps the current card, recording and previous assessments available for retry', async () => {
  serveReview();
  allowMicrophone();
  const transport = fetch;
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => url.endsWith('/progress')
    ? Promise.reject(new TypeError('Network unavailable')) : transport(url, init)));
  page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Thu âm"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Dừng thu âm"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Tiếp"]').trigger('click');
  await flushPromises();
  expect(page.get('[role="alert"]').text()).toContain('Không kết nối được máy chủ');
  expect(page.get('.review-question').text()).toContain('1 / 2');
  expect(page.get('button[aria-label="Nghe bản thu"]').attributes('disabled')).toBeUndefined();
});

test('failure to start a new session does not discard the current temporary recording', async () => {
  serveReview();
  allowMicrophone();
  page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Thu âm"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Dừng thu âm"]').trigger('click');
  await flushPromises();
  const transport = fetch;
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => init?.method === 'POST'
    ? Promise.reject(new TypeError('Network unavailable')) : transport(url, init)));
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  expect(page.get('[role="alert"]').text()).toContain('Không kết nối được máy chủ');
  expect(page.get('button[aria-label="Nghe bản thu"]').attributes('disabled')).toBeUndefined();
});

test('Space on an audio control or settings summary does not also skip the flashcard', async () => {
  serveReview();
  page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Thu âm"]').trigger('keydown', { key: ' ', code: 'Space' });
  await flushPromises();
  expect(page.get('.practice-progress').text()).toContain('1 / 2');
  await page.get('.practice-setup > summary').trigger('keydown', { key: ' ', code: 'Space' });
  await flushPromises();
  expect(page.get('.practice-progress').text()).toContain('1 / 2');
});
