// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import App from './App.vue';
import { learningApi, type LearningFolder, type SavedLearningItem, type TrashEntry } from './api';

vi.mock('./api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api')>();
  return {
    ...original,
    learningApi: {
      me: vi.fn(), register: vi.fn(), login: vi.fn(), logout: vi.fn(),
      approveLink: vi.fn(), folders: vi.fn(), createFolder: vi.fn(), updateFolder: vi.fn(), items: vi.fn(), updateItem: vi.fn(),
      trash: vi.fn(), trashItem: vi.fn(), trashFolder: vi.fn(), restoreItem: vi.fn(), restoreFolder: vi.fn(),
      permanentlyDeleteItem: vi.fn(), permanentlyDeleteFolder: vi.fn(), emptyTrash: vi.fn(),
    },
  };
});

const api = vi.mocked(learningApi);
let storedFolders: LearningFolder[];
let storedItems: SavedLearningItem[];
let storedTrash: TrashEntry[];

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
  storedFolders = [];
  storedItems = [];
  storedTrash = [];
  vi.clearAllMocks();
  api.me.mockResolvedValue({ id: 'person-1', username: 'learner' });
  api.folders.mockImplementation(async () => [...storedFolders]);
  api.items.mockImplementation(async () => [...storedItems]);
  api.trash.mockImplementation(async () => [...storedTrash]);
  api.updateItem.mockImplementation(async (id, change) => {
    const item = storedItems.find((entry) => entry.id === id)!;
    Object.assign(item, change);
    return { ...item };
  });
  api.createFolder.mockImplementation(async (name, parent_id) => {
    const folder = { id: `folder-${storedFolders.length + 1}`, name, parent_id };
    storedFolders.push(folder);
    return folder;
  });
  api.updateFolder.mockImplementation(async (id, change) => {
    const folder = storedFolders.find((item) => item.id === id)!;
    Object.assign(folder, change);
    return { ...folder };
  });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

test('learner deletes item, finds it in Trash, and restores it', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }];
  storedItems = [{ id: 'w1', folder_id: 'f1', category: 'word', text: '学习', meaning: 'học', pinyin: 'xué xí', created_at: 1700000000000, linked_item_ids: [] }];
  api.trashItem.mockImplementation(async (id) => {
    const item = storedItems.find((entry) => entry.id === id)!;
    storedItems = storedItems.filter((entry) => entry.id !== id);
    storedTrash.push({ id, kind: 'item', name: item.text, category: item.category, folder_id: item.folder_id });
  });
  api.restoreItem.mockImplementation(async (id) => {
    storedTrash = storedTrash.filter((entry) => entry.id !== id);
    storedItems.push({ id, folder_id: 'f1', category: 'word', text: '学习', meaning: 'học', pinyin: 'xué xí', created_at: 1700000000000, linked_item_ids: [] });
    return storedItems[0]!;
  });
  const page = mount(App, { attachTo: document.body });
  await flushPromises();

  await page.get('button[aria-label="Xóa 学习"]').trigger('click');
  await page.get('.confirm-dialog button[type="submit"]').trigger('click');
  await flushPromises();
  expect(page.text()).toContain('Đã chuyển mục học tập vào thùng rác');
  await page.get('button[aria-label="Mở thùng rác"]').trigger('click');
  await flushPromises();
  expect(page.text()).toContain('学习');
  await page.get('button[aria-label="Khôi phục 学习"]').trigger('click');
  await flushPromises();
  expect(api.restoreItem).toHaveBeenCalledWith('w1');
  expect(page.text()).toContain('Đã khôi phục');
  page.unmount();
});

test('permanent deletion waits for confirmation and empty Trash is explicit', async () => {
  storedTrash = [{ id: 'f1', kind: 'folder', name: 'HSK', category: null, folder_id: null }];
  api.permanentlyDeleteFolder.mockImplementation(async () => { storedTrash = []; });
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Mở thùng rác"]').trigger('click');
  await flushPromises();

  await page.get('button[aria-label="Xóa vĩnh viễn HSK"]').trigger('click');
  expect(api.permanentlyDeleteFolder).not.toHaveBeenCalled();
  expect(page.get('.confirm-dialog').text()).toContain('không thể hoàn tác');
  await page.get('.confirm-dialog .plain-button').trigger('click');
  expect(api.permanentlyDeleteFolder).not.toHaveBeenCalled();
  await page.get('button[aria-label="Xóa vĩnh viễn HSK"]').trigger('click');
  await page.get('.confirm-dialog button[type="submit"]').trigger('click');
  await flushPromises();
  expect(api.permanentlyDeleteFolder).toHaveBeenCalledWith('f1');
  expect(page.text()).toContain('Đã xóa vĩnh viễn');
  expect(page.text()).toContain('Thùng rác trống');
  page.unmount();
});

test('restore feedback names recovery folder when original folder is unavailable', async () => {
  storedTrash = [{ id: 'w1', kind: 'item', name: '你好', category: 'word', folder_id: 'gone' }];
  api.restoreItem.mockImplementation(async () => {
    storedTrash = [];
    storedFolders.push({ id: 'recovered', name: 'Đã khôi phục', parent_id: null });
    const item: SavedLearningItem = { id: 'w1', folder_id: 'recovered', category: 'word', text: '你好', meaning: 'xin chào', pinyin: 'nǐ hǎo', created_at: 1700000000000, linked_item_ids: [] };
    storedItems.push(item);
    return item;
  });
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Mở thùng rác"]').trigger('click');
  await flushPromises();
  await page.get('button[aria-label="Khôi phục 你好"]').trigger('click');
  await flushPromises();
  expect(page.get('.trash-feedback').text()).toContain('Đã khôi phục');
  expect(page.get('.trash-feedback').text()).toContain('Đã khôi phục”');
  page.unmount();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('delete confirmation disappears after a short time', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }];
  storedItems = [{ id: 'w1', folder_id: 'f1', category: 'word', text: '学习', meaning: 'học', pinyin: '', created_at: 1700000000000, linked_item_ids: [] }];
  api.trashItem.mockImplementation(async () => { storedItems = []; });
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  vi.useFakeTimers();
  await page.get('button[aria-label="Xóa 学习"]').trigger('click');
  await page.get('.confirm-dialog button[type="submit"]').trigger('click');
  await flushPromises();
  expect(page.get('.trash-feedback').text()).toContain('Đã chuyển mục học tập vào thùng rác');
  vi.advanceTimersByTime(5000);
  await page.vm.$nextTick();
  expect(page.find('.trash-feedback').exists()).toBe(false);
  page.unmount();
});

test('pagination stays visible with only one page of items', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }];
  storedItems = Array.from({ length: 3 }, (_, index): SavedLearningItem => ({
    id: `w${index}`, folder_id: 'f1', category: 'word', text: `Từ ${index}`, meaning: '', pinyin: '',
    created_at: 1700000000000 + index, linked_item_ids: [],
  }));
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!.trigger('click');
  const pagination = page.get('nav[aria-label="Phân trang mục học tập"]');
  expect(pagination.text()).toContain('Trang 1 / 1');
  expect(pagination.get('button[aria-label="Trang trước"]').attributes('disabled')).toBeDefined();
  expect(pagination.get('button[aria-label="Trang sau"]').attributes('disabled')).toBeDefined();
  page.unmount();
});

test('folder items show immediately and can be filtered by word or sentence', async () => {
  storedFolders = [
    { id: 'f1', name: 'HSK 1', parent_id: null },
    { id: 'f2', name: 'HSK 2', parent_id: null },
  ];
  storedItems = [
    { id: 'w1', folder_id: 'f1', category: 'word', text: '学习', meaning: 'học', pinyin: '', created_at: 1700000000000, linked_item_ids: [] },
    { id: 's1', folder_id: 'f1', category: 'sentence', text: '我学习。', meaning: 'Tôi học', pinyin: '', created_at: 1700000000001, linked_item_ids: [] },
    { id: 'w2', folder_id: 'f2', category: 'word', text: '你好', meaning: 'chào', pinyin: '', created_at: 1700000000001, linked_item_ids: [] },
  ];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!.trigger('click');
  expect(page.get('#learning-item-w1').text()).toContain('学习');
  expect(page.get('#learning-item-s1').text()).toContain('我学习。');
  expect(page.find('button[aria-label="Xem toàn bộ từ và câu"]').exists()).toBe(false);
  const category = page.get('select[aria-label="Lọc mục học tập"]');
  expect((category.element as HTMLSelectElement).value).toBe('all');
  await category.setValue('word');
  expect(page.find('#learning-item-w1').exists()).toBe(true);
  expect(page.find('#learning-item-s1').exists()).toBe(false);
  await category.setValue('sentence');
  expect(page.find('#learning-item-w1').exists()).toBe(false);
  expect(page.find('#learning-item-s1').exists()).toBe(true);
  await page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[2]!.trigger('click');
  expect((page.get('select[aria-label="Lọc mục học tập"]').element as HTMLSelectElement).value).toBe('all');
  expect(page.get('#learning-item-w2').text()).toContain('你好');
  page.unmount();
});

test('learner edits saved item and follows linked context on website', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }, { id: 'f2', name: 'Other', parent_id: null }];
  storedItems = [
    { id: 'w1', folder_id: 'f1', category: 'word', text: '学习', meaning: 'học', pinyin: 'xué xí', created_at: 1700000000000, linked_item_ids: ['s1'] },
    { id: 's1', folder_id: 'f1', category: 'sentence', text: '我学习。', meaning: 'Tôi học.', pinyin: 'wǒ xué xí 。', created_at: 1700000001000, linked_item_ids: ['w1'] },
  ];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!.trigger('click');
  expect(page.text()).toContain('学习');
  await page.get('button[aria-label="Sửa 学习"]').trigger('click');
  await page.get('#item-text').setValue('学中文');
  await page.get('#item-meaning').setValue('học tiếng Trung');
  await page.get('#item-folder').setValue('f2');
  await page.get('.item-editor form').trigger('submit');
  await flushPromises();
  expect(api.updateItem).toHaveBeenCalledWith('w1', { text: '学中文', meaning: 'học tiếng Trung', category: 'word', folder_id: 'f2' });
  await page.get('button[aria-label="Xem 1 từ liên kết của 我学习。"]').trigger('click');
  await page.get('.linked-items-dialog button[aria-label="Mở 学中文"]').trigger('click');
  await flushPromises();
  expect(page.text()).toContain('学中文');
  expect(page.get('#learning-item-w1').attributes('class')).toContain('focused');
  page.unmount();
});

test('linked sentences stay off word cards and open in an interactive dialog', async () => {
  storedFolders = [{ id: 'f1', name: 'Từ vựng', parent_id: null }, { id: 'f2', name: 'Ví dụ', parent_id: null }];
  storedItems = [
    { id: 'w1', folder_id: 'f1', category: 'word', text: '学习', meaning: 'học', pinyin: 'xué xí', created_at: 1700000000000, linked_item_ids: ['s1'] },
    { id: 's1', folder_id: 'f2', category: 'sentence', text: '我学习。', meaning: 'Tôi học.', pinyin: 'wǒ xué xí', created_at: 1700000001000, linked_item_ids: ['w1'] },
  ];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!.trigger('click');
  expect(page.get('#learning-item-w1').text()).not.toContain('我学习。');
  expect(page.find('.linked-items-dialog[open]').exists()).toBe(false);
  await page.get('button[aria-label="Xem 1 câu liên kết của 学习"]').trigger('click');
  const dialog = page.get('.linked-items-dialog[open]');
  expect(dialog.text()).toContain('我学习。');
  expect(dialog.text()).toContain('wǒ xué xí');
  expect(dialog.text()).toContain('Tôi học.');
  await dialog.get('button[aria-label="Sửa 我学习。 trong liên kết"]').trigger('click');
  expect(page.find('.linked-items-dialog[open]').exists()).toBe(false);
  expect(page.get('.item-editor[open] #item-text').element).toHaveProperty('value', '我学习。');
  await page.get('.item-editor .plain-button').trigger('click');
  await page.get('button[aria-label="Xem 1 câu liên kết của 学习"]').trigger('click');
  const reopened = page.get('.linked-items-dialog[open]');
  await reopened.get('button[aria-label="Mở 我学习。"]').trigger('click');
  expect(page.find('.linked-items-dialog[open]').exists()).toBe(false);
  expect(page.get('#learning-item-s1').attributes('class')).toContain('focused');
  page.unmount();
});

test('creates, browses, renames and moves a nested folder through the website', async () => {
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  expect(page.text()).toContain('Chưa có mục học tập');

  await page.get('nav[aria-label="Cây thư mục"] .tree-button').trigger('contextmenu', { clientX: 90, clientY: 90 });
  await flushPromises();
  expect(page.get('[role="menu"]').text()).toContain('Tạo thư mục gốc');
  await page.get('[role="menu"] [role="menuitem"]').trigger('click');
  await page.get('#folder-name').setValue('HSK 1');
  await page.get('dialog form').trigger('submit');
  await flushPromises();
  expect(api.createFolder).toHaveBeenCalledWith('HSK 1', null);
  expect(page.text()).toContain('HSK 1');

  await page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!.trigger('contextmenu', { clientX: 100, clientY: 120 });
  await flushPromises();
  expect(page.get('[role="menu"]').findAll('[role="menuitem"]').map((item) => item.text())).toEqual([
    'Tạo thư mục con', 'Đổi tên', 'Chuyển thư mục', 'Xóa thư mục',
  ]);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await page.vm.$nextTick();
  expect(page.find('[role="menu"]').exists()).toBe(false);
  await page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!.trigger('contextmenu', { clientX: 100, clientY: 120 });
  await flushPromises();
  await page.get('[role="menu"] [role="menuitem"]').trigger('click');
  await page.get('#folder-name').setValue('Bài 01');
  await page.get('dialog form').trigger('submit');
  await flushPromises();
  expect(api.createFolder).toHaveBeenCalledWith('Bài 01', 'folder-1');
  const breadcrumb = page.get('nav[aria-label="Đường dẫn thư mục"]');
  expect(breadcrumb.findAll('button').map((button) => button.text())).toEqual(['Thư viện', 'HSK 1', 'Bài 01']);
  expect(breadcrumb.findAll('button')[2]!.attributes('aria-current')).toBe('page');

  await page.get('.breadcrumb').findAll('button')[1]!.trigger('click');
  expect(breadcrumb.findAll('button')[1]!.attributes('aria-current')).toBe('page');
  await page.get('select[aria-label="Chọn thư mục con"]').setValue('folder-2');
  await page.get('button[aria-label="Tùy chọn Bài 01"]').trigger('click');
  await page.get('[role="menu"] button:nth-of-type(2)').trigger('click');
  await page.get('#folder-name').setValue('Bài 02');
  await page.get('dialog form').trigger('submit');
  await flushPromises();
  expect(api.updateFolder).toHaveBeenCalledWith('folder-2', { name: 'Bài 02' });

  await page.get('button[aria-label="Tùy chọn Bài 02"]').trigger('click');
  await page.get('[role="menu"] button:nth-of-type(3)').trigger('click');
  const destinations = page.get('#folder-parent').findAll('option');
  expect(destinations.map((option) => option.text())).toEqual(['Thư viện (gốc)', 'HSK 1']);
  const parentSelect = page.get('#folder-parent');
  (parentSelect.element as HTMLSelectElement).selectedIndex = 0;
  await parentSelect.trigger('change');
  await page.get('dialog form').trigger('submit');
  await flushPromises();
  expect(api.updateFolder).toHaveBeenCalledWith('folder-2', { parent_id: null });
  expect(page.get('nav[aria-label="Cây thư mục"]').text()).toContain('Bài 02');
  page.unmount();
});

test('asks for sign in and approves an extension link for the signed in account', async () => {
  window.history.replaceState({}, '', '/?link=request-1');
  api.me.mockRejectedValueOnce(new Error('not signed in'));
  api.login.mockResolvedValue({ id: 'person-1', username: 'learner' });
  api.approveLink.mockResolvedValue();
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  expect(page.text()).toContain('Đăng nhập rồi xác nhận liên kết extension');
  expect(page.get('#username').attributes('minlength')).toBeUndefined();
  expect(page.get('#username').attributes('maxlength')).toBeUndefined();
  expect(page.get('#password').attributes('minlength')).toBeUndefined();
  expect(page.get('#password').attributes('maxlength')).toBeUndefined();
  await page.get('#username').setValue('learner');
  await page.get('#password').setValue('long-password');
  await page.get('.auth-form').trigger('submit');
  await flushPromises();
  expect(api.login).toHaveBeenCalledWith('learner', 'long-password');
  await page.get('.link-button').trigger('click');
  await flushPromises();
  expect(api.approveLink).toHaveBeenCalledWith('request-1');
  expect(page.text()).toContain('Đã liên kết');
  page.unmount();
});

test('folder location and child dropdown count only items at selected level', async () => {
  storedFolders = [
    { id: 'f1', name: 'HSK 1', parent_id: null },
    { id: 'f2', name: 'HSK 2', parent_id: null },
    { id: 'f3', name: 'Bài 1', parent_id: 'f1' },
  ];
  storedItems = [
    { id: 'w1', folder_id: 'f1', category: 'word', text: '你好', meaning: 'xin chào', pinyin: 'nǐ hǎo', created_at: 1700000000001, linked_item_ids: [] },
    { id: 'w2', folder_id: 'f1', category: 'word', text: '学习', meaning: 'học', pinyin: 'xué xí', created_at: 1700000000002, linked_item_ids: [] },
    { id: 's1', folder_id: 'f1', category: 'sentence', text: '我学习。', meaning: 'Tôi học.', pinyin: '', created_at: 1700000000003, linked_item_ids: [] },
    { id: 'w3', folder_id: 'f3', category: 'word', text: '中文', meaning: 'Trung văn', pinyin: '', created_at: 1700000000004, linked_item_ids: [] },
    { id: 's2', folder_id: 'f2', category: 'sentence', text: '你好吗？', meaning: 'Bạn khỏe không?', pinyin: '', created_at: 1700000000005, linked_item_ids: [] },
  ];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();

  expect(page.get('[aria-label="Thống kê vị trí hiện tại"]').text()).toMatch(/3\s*từ.*2\s*câu/s);
  await page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!.trigger('click');
  expect(page.get('[aria-label="Thống kê vị trí hiện tại"]').text()).toMatch(/2\s*từ.*1\s*câu/s);
  expect(page.get('select[aria-label="Chọn thư mục con"]').text()).toMatch(/Bài 1 · 1 từ · 0 câu/);
  await page.get('select[aria-label="Chọn thư mục con"]').setValue('f3');
  expect(page.find('.empty-state').exists()).toBe(false);
  expect(page.get('[aria-label="Thống kê vị trí hiện tại"]').text()).toMatch(/1\s*từ.*0\s*câu/s);
  page.unmount();
});

test('breadcrumb carries current folder counts and child navigation without extra header', async () => {
  storedFolders = [
    { id: 'f1', name: 'HSK 1', parent_id: null },
    { id: 'f2', name: 'Bài 1', parent_id: 'f1' },
  ];
  storedItems = [
    { id: 'w1', folder_id: 'f1', category: 'word', text: '你好', meaning: 'chào', pinyin: '', created_at: 1700000000000, linked_item_ids: [] },
    { id: 's1', folder_id: 'f2', category: 'sentence', text: '你好！', meaning: 'chào', pinyin: '', created_at: 1700000000001, linked_item_ids: [] },
  ];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!.trigger('click');
  expect(page.find('.library-main:not(.trash-main) .library-header').exists()).toBe(false);
  expect(page.get('nav[aria-label="Đường dẫn thư mục"] [aria-label="Thống kê vị trí hiện tại"]').text()).toBe('(1 từ · 0 câu)');
  await page.get('nav[aria-label="Đường dẫn thư mục"] select[aria-label="Chọn thư mục con"]').setValue('f2');
  expect(page.get('nav[aria-label="Đường dẫn thư mục"] [aria-label="Thống kê vị trí hiện tại"]').text()).toBe('(0 từ · 1 câu)');
  expect(page.find('nav[aria-label="Đường dẫn thư mục"] select').exists()).toBe(false);
  page.unmount();
});

test('sidebar exposes folder actions without right click', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK 1', parent_id: null }];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Tùy chọn HSK 1"]').trigger('click');
  expect(page.get('[role="menu"]').text()).toContain('Tạo thư mục con');
  expect(page.get('[role="menu"]').text()).toContain('Đổi tên');
  expect(page.get('[role="menu"]').text()).toContain('Chuyển thư mục');
  expect(page.get('[role="menu"]').text()).toContain('Xóa thư mục');
  await page.get('[role="menu"] button:nth-of-type(2)').trigger('click');
  expect(page.get('#folder-name').element).toHaveProperty('value', 'HSK 1');
  page.unmount();
});

test('items show added time, stable numbering, pagination and oldest first order', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }];
  storedItems = Array.from({ length: 25 }, (_, index): SavedLearningItem => ({
    id: `i${index + 1}`, folder_id: 'f1', category: index % 2 ? 'sentence' : 'word',
    text: `Mục ${index + 1}`, meaning: `Nghĩa ${index + 1}`, pinyin: '',
    created_at: 1700000000000 + index * 1000, linked_item_ids: [],
  }));
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!.trigger('click');

  expect(page.get('[aria-label="Mục học tập số 1"]').text()).toContain('Mục 25');
  expect(page.findAll('.saved-item-row')).toHaveLength(20);
  expect(page.get('[aria-label="Mục học tập số 1"]').text()).toMatch(/\d{1,2}\/\d{1,2}\/2023/);
  await page.get('button[aria-label="Trang sau"]').trigger('click');
  expect(page.get('[aria-label="Mục học tập số 21"]').text()).toContain('Mục 5');
  expect(page.text()).toContain('Trang 2 / 2');
  await page.get('select[aria-label="Sắp xếp mục học tập"]').setValue('oldest');
  expect(page.get('[aria-label="Mục học tập số 1"]').text()).toContain('Mục 1');
  expect(page.text()).toContain('Trang 1 / 2');
  page.unmount();
});

test('display dropdown independently hides card fields and remembers selection', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }];
  storedItems = [{ id: 'w1', folder_id: 'f1', category: 'word', text: '学习', meaning: 'học', pinyin: 'xué xí', created_at: 1700000000000, linked_item_ids: [] }];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!.trigger('click');
  const card = page.get('#learning-item-w1');
  expect(card.text()).toContain('学习');
  expect(card.text()).toContain('xué xí');
  expect(card.text()).toContain('học');
  await page.get('input[aria-label="Hiển thị tiếng Trung"]').setValue(false);
  await page.get('input[aria-label="Hiển thị Pinyin"]').setValue(false);
  expect(card.text()).not.toContain('学习');
  expect(card.text()).not.toContain('xué xí');
  expect(card.text()).toContain('học');
  page.unmount();

  const reopened = mount(App, { attachTo: document.body });
  await flushPromises();
  await reopened.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!.trigger('click');
  expect(reopened.get('#learning-item-w1').text()).not.toContain('学习');
  expect(reopened.get('#learning-item-w1').text()).not.toContain('xué xí');
  expect(reopened.get('#learning-item-w1').text()).toContain('học');
  await reopened.get('input[aria-label="Hiển thị tiếng Việt"]').setValue(false);
  expect(reopened.get('#learning-item-w1').text()).not.toContain('học');
  reopened.unmount();
});
