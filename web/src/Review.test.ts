// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import Review from './Review.vue';
import { learningApi } from './api';

vi.mock('./api', () => ({ learningApi: { reviewOverview: vi.fn(), startReview: vi.fn(), recordRecall: vi.fn() } }));

test('learner reviews vocabulary with flip, scratchpad, correction and summary', async () => {
  const api = vi.mocked(learningApi);
  api.reviewOverview.mockResolvedValue({ entries: [], totals: { remembered: 0, not_yet: 0 } });
  api.startReview.mockResolvedValue({ id: 'session', kind: 'vocabulary', ineligible_count: 0, questions: [
    { sentence: null, item_ids: ['one'], items: [{ id: 'one', folder_id: 'f', category: 'word', text: '你好', meaning: 'xin chào', pinyin: 'nǐ hǎo', created_at: 1, linked_item_ids: [] }] },
  ] });
  api.recordRecall.mockResolvedValue({ item_id: 'one', result: 'not_yet' });
  const page = mount(Review, { props: { folders: [{ id: 'f', name: 'HSK', parent_id: null }] }, attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  expect(page.text()).toContain('xin chào');
  expect(page.get('.review-card-face-back').attributes('aria-hidden')).toBe('true');
  await page.get('textarea[aria-label="Ô nháp ôn tập"]').setValue('my answer');
  await page.get('button[aria-label="Lật thẻ"]').trigger('click');
  expect(page.text()).toContain('nǐ hǎo');
  await page.get('button[aria-label="Chưa nhớ"]').trigger('click');
  await flushPromises();
  expect(api.recordRecall).toHaveBeenCalledWith('session', 'one', 'not_yet');
  expect(page.text()).toContain('Tóm tắt ôn tập');
  await page.get('button[aria-label="Lùi"]').trigger('click');
  expect((page.get('textarea[aria-label="Ô nháp ôn tập"]').element as HTMLTextAreaElement).value).toBe('my answer');
  await page.get('button[aria-label="Tiếp"]').trigger('click');
  await flushPromises();
  expect(api.recordRecall).toHaveBeenCalledWith('session', 'one', 'remembered');
  page.unmount();
});

test('grammar question skips before reveal and grades linked entries separately', async () => {
  const api = vi.mocked(learningApi);
  api.reviewOverview.mockResolvedValue({ entries: [], totals: { remembered: 0, not_yet: 0 } });
  api.startReview.mockResolvedValue({ id: 'grammar-session', kind: 'grammar', ineligible_count: 1, ineligible_item_ids: ['missing'], questions: [
    { sentence: { id: 's1', folder_id: 'outside', category: 'sentence', text: '我正在学习。', meaning: 'Tôi đang học.', pinyin: 'wǒ zhèng zài xué xí', created_at: 1, linked_item_ids: ['g1', 'g2'] }, item_ids: ['g1', 'g2'], items: [
      { id: 'g1', folder_id: 'f', category: 'grammar', text: '正在 + V', meaning: 'đang', pinyin: '', created_at: 1, linked_item_ids: ['s1'] },
      { id: 'g2', folder_id: 'f', category: 'grammar', text: '主语 + V', meaning: 'chủ ngữ', pinyin: '', created_at: 1, linked_item_ids: ['s1'] },
    ] },
  ] });
  api.recordRecall.mockImplementation(async (_session, item_id, result) => ({ item_id, result }));
  const page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('select[aria-label="Hoạt động ôn tập"]').setValue('grammar');
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  expect(page.text()).toContain('我正在学习。');
  expect(page.text()).not.toContain('Tôi đang học.');
  await page.get('button[aria-label="Hiện Pinyin"]').trigger('click');
  expect(page.text()).toContain('wǒ zhèng zài xué xí');
  await page.get('button[aria-label="Tiếp"]').trigger('click');
  expect(api.recordRecall).not.toHaveBeenCalled();
  await page.get('button[aria-label="Lùi"]').trigger('click');
  expect(page.text()).not.toContain('wǒ zhèng zài xué xí');
  await page.get('button[aria-label="Xem đáp án"]').trigger('click');
  expect(page.text()).toContain('Tôi đang học.');
  await page.get('button[aria-label="Chưa nhớ 正在 + V"]').trigger('click');
  await flushPromises();
  expect(page.text()).toContain('主语 + V');
  await page.get('button[aria-label="Tiếp"]').trigger('click');
  await flushPromises();
  expect(api.recordRecall).toHaveBeenCalledWith('grammar-session', 'g1', 'not_yet');
  expect(api.recordRecall).toHaveBeenCalledWith('grammar-session', 'g2', 'remembered');
  expect(page.text()).toContain('Tóm tắt ôn tập');
  page.unmount();
});

test('Space advances outside editable fields but types inside scratchpad', async () => {
  const api = vi.mocked(learningApi);
  api.reviewOverview.mockResolvedValue({ entries: [], totals: { remembered: 0, not_yet: 0 } });
  api.startReview.mockResolvedValue({ id: 'space-session', kind: 'vocabulary', ineligible_count: 0, questions: [
    { sentence: null, item_ids: ['one'], items: [{ id: 'one', folder_id: 'f', category: 'word', text: '你好', meaning: 'xin chào', pinyin: 'nǐ hǎo', created_at: 1, linked_item_ids: [] }] },
  ] });
  api.recordRecall.mockResolvedValue({ item_id: 'one', result: 'remembered' });
  const page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  const scratchpad = page.get('textarea[aria-label="Ô nháp ôn tập"]');
  (scratchpad.element as HTMLTextAreaElement).focus();
  scratchpad.element.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  expect(api.recordRecall).not.toHaveBeenCalled();
  (scratchpad.element as HTMLTextAreaElement).blur();
  page.get('button[aria-label="Lật thẻ"]').element.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));
  expect(api.recordRecall).not.toHaveBeenCalled();
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));
  await flushPromises();
  expect(api.recordRecall).toHaveBeenCalledWith('space-session', 'one', 'remembered');
  page.unmount();
});

test('review scope and three flashcard prompt modes change visible front', async () => {
  const api = vi.mocked(learningApi);
  api.reviewOverview.mockResolvedValue({ entries: [], totals: { remembered: 0, not_yet: 0 } });
  api.startReview.mockResolvedValue({ id: 'modes', kind: 'vocabulary', ineligible_count: 0, questions: [
    { sentence: null, item_ids: ['one'], items: [{ id: 'one', folder_id: 'child', category: 'word', text: '你好', meaning: 'xin chào', pinyin: 'nǐ hǎo', created_at: 1, linked_item_ids: [] }] },
  ] });
  const page = mount(Review, { props: { folders: [{ id: 'root', name: 'HSK', parent_id: null }, { id: 'child', name: 'HSK 1', parent_id: 'root' }] }, attachTo: document.body });
  await flushPromises();
  expect(page.get('.review-scope-tree').find('[data-folder-id="child"]').exists()).toBe(false);
  await page.get('button[aria-label="Mở thư mục HSK"]').trigger('click');
  expect(page.get('.review-scope-tree').find('[data-folder-id="child"]').exists()).toBe(true);
  await page.get('[data-folder-id="root"]').trigger('click');
  await flushPromises();
  expect(api.reviewOverview).toHaveBeenCalledWith('root');
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  expect(api.startReview).toHaveBeenCalledWith('vocabulary', 'root');
  expect(page.get('.review-front').text()).toBe('xin chào');
  await page.get('select[aria-label="Mặt trước flashcard"]').setValue('chinese');
  expect(page.get('.review-front').text()).toBe('你好');
  await page.get('select[aria-label="Mặt trước flashcard"]').setValue('pinyin');
  expect(page.get('.review-front').text()).toBe('nǐ hǎo');
  page.unmount();
});

test('flashcard is first in play area and flips in both directions by clicking the card', async () => {
  const api = vi.mocked(learningApi);
  api.reviewOverview.mockResolvedValue({ entries: [], totals: { remembered: 0, not_yet: 0 } });
  api.startReview.mockResolvedValue({ id: 'flip', kind: 'vocabulary', ineligible_count: 0, questions: [
    { sentence: null, item_ids: ['one'], items: [{ id: 'one', folder_id: 'f', category: 'word', text: '你好', meaning: 'xin chào', pinyin: 'nǐ hǎo', created_at: 1, linked_item_ids: [] }] },
  ] });
  const page = mount(Review, { props: { folders: [] }, attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Bắt đầu ôn tập"]').trigger('click');
  await flushPromises();
  expect(page.get('.review-question').element.compareDocumentPosition(page.get('.review-statistics').element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const card = page.get('button[aria-label="Lật thẻ"]');
  expect(card.attributes('aria-pressed')).toBe('false');
  expect(page.get('.review-card-face-back').attributes('aria-hidden')).toBe('true');
  await card.trigger('click');
  expect(card.classes()).toContain('is-flipped');
  expect(card.attributes('aria-pressed')).toBe('true');
  expect(page.get('.review-card-face-back').attributes('aria-hidden')).toBe('false');
  expect(page.get('.review-back').text()).toContain('你好');
  await card.trigger('click');
  expect(card.classes()).not.toContain('is-flipped');
  expect(card.attributes('aria-pressed')).toBe('false');
  page.unmount();
});
