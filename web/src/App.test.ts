// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import App from './App.vue';
import { ApiError, learningApi, type LearningFolder, type SavedLearningItem, type TrashEntry } from './api';

vi.mock('./api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api')>();
  return {
    ...original,
    learningApi: {
      me: vi.fn(), register: vi.fn(), login: vi.fn(), logout: vi.fn(),
      approveLink: vi.fn(), folders: vi.fn(), createFolder: vi.fn(), updateFolder: vi.fn(), items: vi.fn(), createItem: vi.fn(), suggestMeaning: vi.fn(), updateItem: vi.fn(),
      addItemLink: vi.fn(), removeItemLink: vi.fn(), createItemWithExamples: vi.fn(), updateItemWithExamples: vi.fn(),
      trash: vi.fn(), trashItem: vi.fn(), trashFolderItems: vi.fn(), trashFolder: vi.fn(), restoreItem: vi.fn(), restoreFolder: vi.fn(),
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

test('folder selection deletes checked items, then clears remaining direct items only', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }, { id: 'child', name: 'Bài 1', parent_id: 'f1' }];
  storedItems = [
    { id: 'w1', folder_id: 'f1', category: 'word', text: '学习', meaning: 'học', pinyin: '', created_at: 1700000000000, linked_item_ids: [] },
    { id: 'w2', folder_id: 'f1', category: 'word', text: '你好', meaning: 'chào', pinyin: '', created_at: 1700000000001, linked_item_ids: [] },
    { id: 'child-word', folder_id: 'child', category: 'word', text: '中文', meaning: 'Trung văn', pinyin: '', created_at: 1700000000002, linked_item_ids: [] },
  ];
  api.trashFolderItems.mockImplementation(async (folderId, itemIds) => {
    const removed = storedItems.filter(item => item.folder_id === folderId && (!itemIds || itemIds.includes(item.id)));
    storedItems = storedItems.filter(item => !removed.includes(item));
    storedTrash.push(...removed.map(item => ({ id: item.id, kind: 'item' as const, name: item.text, category: item.category, folder_id: item.folder_id })));
    return { count: removed.length };
  });
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('nav[aria-label="Cây thư mục"] .tree-row:nth-child(2) .tree-button').trigger('click');
  await page.get('input[aria-label="Chọn 学习"]').setValue(true);
  await page.get('button[aria-label="Xóa mục đã chọn"]').trigger('click');
  expect(api.trashFolderItems).not.toHaveBeenCalled();
  await page.get('.confirm-dialog button[type="submit"]').trigger('click');
  await flushPromises();
  expect(api.trashFolderItems).toHaveBeenCalledWith('f1', ['w1']);
  expect(page.find('input[aria-label="Chọn 你好"]').exists()).toBe(true);
  await page.get('button[aria-label="Dọn sạch thư mục"]').trigger('click');
  await page.get('.confirm-dialog button[type="submit"]').trigger('click');
  await flushPromises();
  expect(api.trashFolderItems).toHaveBeenLastCalledWith('f1');
  expect(storedItems.map(item => item.id)).toEqual(['child-word']);
  expect(storedFolders).toHaveLength(2);
  page.unmount();
});

test('one folder confirmation moves the selected folder to Trash', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK 1', parent_id: null }];
  api.trashFolder.mockImplementation(async (id) => {
    storedFolders = storedFolders.filter((folder) => folder.id !== id);
    storedTrash.push({ id, kind: 'folder', name: 'HSK 1', category: null, folder_id: null });
  });
  const page = mount(App, { attachTo: document.body });
  await flushPromises();

  await page.get('button[aria-label="Tùy chọn HSK 1"]').trigger('click');
  await page.get('.folder-context-menu > button:last-child').trigger('click');
  expect(api.trashFolder).not.toHaveBeenCalled();
  expect(page.find('[role="menu"]').exists()).toBe(false);
  expect(page.get('.confirm-dialog').text()).toContain('HSK 1');

  await page.get('.confirm-dialog button[type="submit"]').trigger('click');
  await flushPromises();
  expect(api.trashFolder).toHaveBeenCalledTimes(1);
  expect(api.trashFolder).toHaveBeenCalledWith('f1');
  expect(page.get('.confirm-dialog').attributes('open')).toBeUndefined();
  await page.get('button[aria-label="Mở thùng rác"]').trigger('click');
  await flushPromises();
  expect(page.text()).toContain('HSK 1');
  page.unmount();
});

test('username patterns compile in Chrome Unicode mode', async () => {
  api.me.mockRejectedValue(new ApiError(401, 'Sign in required'));
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  const registerPattern = () => new RegExp(`^(?:${page.get('#username').attributes('pattern')})$`, 'v');
  await page.get('.auth-switch button').trigger('click');
  expect(registerPattern().test('hoc-vien_1')).toBe(true);
  expect(registerPattern().test('hoc vien')).toBe(false);
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

test('learner expands folder levels and sees child folders above direct items', async () => {
  storedFolders = [
    { id: 'root', name: 'HSK', parent_id: null },
    { id: 'other', name: 'Du lịch', parent_id: null },
    { id: 'child', name: 'Bài 01', parent_id: 'root' },
    { id: 'grandchild', name: 'Từ mới', parent_id: 'child' },
  ];
  storedItems = [
    { id: 'root-word', folder_id: 'root', category: 'word', text: '学习', meaning: 'học', pinyin: 'xué xí', created_at: 1700000000000, linked_item_ids: [] },
    { id: 'child-word', folder_id: 'child', category: 'word', text: '中文', meaning: 'tiếng Trung', pinyin: 'zhōng wén', created_at: 1700000000001, linked_item_ids: [] },
  ];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  const sidebar = page.get('nav[aria-label="Cây thư mục"]');
  expect(sidebar.text()).toContain('HSK');
  expect(sidebar.text()).not.toContain('Bài 01');
  expect(sidebar.text()).not.toContain('Từ mới');

  await sidebar.findAll('.tree-button').find(button => button.text().includes('HSK'))!.trigger('click');
  expect(sidebar.text()).toContain('Bài 01');
  expect(sidebar.text()).not.toContain('Từ mới');
  expect(page.get('.child-folder-grid').text()).toContain('Bài 01');
  expect(page.get('#learning-item-root-word').text()).toContain('学习');
  expect(page.find('#learning-item-child-word').exists()).toBe(false);

  await sidebar.findAll('.tree-button').find(button => button.text().includes('Bài 01'))!.trigger('click');
  expect(sidebar.text()).toContain('Từ mới');
  expect(page.get('.child-folder-grid').text()).toContain('Từ mới');
  expect(page.get('#learning-item-child-word').text()).toContain('中文');
  page.unmount();
});

test('folder arrow follows name so sibling folder icons start at same position', async () => {
  storedFolders = [
    { id: 'parent', name: 'HSK 1', parent_id: null },
    { id: 'leaf', name: 'HSK-2', parent_id: null },
    { id: 'child', name: 'Bài 01', parent_id: 'parent' },
  ];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  const rows = page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-row');
  const parent = rows.find(row => row.text().includes('HSK 1'))!.get('.tree-button');
  const leaf = rows.find(row => row.text().includes('HSK-2'))!.get('.tree-button');
  expect(parent.element.children[0]?.classList.contains('lucide-folder')).toBe(true);
  expect(parent.element.children[1]?.textContent).toBe('HSK 1');
  expect(parent.element.children[2]?.classList.contains('tree-chevron')).toBe(true);
  expect(leaf.element.children[0]?.classList.contains('lucide-folder')).toBe(true);
  expect(leaf.element.children[1]?.textContent).toBe('HSK-2');
  page.unmount();
});

test('folder options open on ellipsis hover and Add reveals a separate submenu', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  const options = page.get('button[aria-label="Tùy chọn HSK"]');
  await options.trigger('mouseenter');
  await flushPromises();
  expect(page.get('.folder-context-menu').text()).toContain('Đổi tên');
  const add = page.findAll('[role="menuitem"]').find(button => button.text() === 'Thêm')!;
  expect(add.attributes('aria-haspopup')).toBe('menu');
  expect(add.find('.folder-submenu-indicator').exists()).toBe(true);
  await page.get('.folder-submenu-anchor').trigger('mouseenter');
  expect(page.get('.folder-submenu').text()).toContain('Từ / cụm từ');
  expect(page.get('.folder-context-menu > button:last-child').text()).toContain('Xóa thư mục');
  page.unmount();
});

test('older folders remain above newly created siblings in both folder views', async () => {
  storedFolders = [{ id: 'older', name: 'Zebra', parent_id: null }];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Tùy chọn Thư viện"]').trigger('click');
  await page.get('.folder-context-menu > button').trigger('click');
  await page.get('#folder-name').setValue('Alpha');
  await page.get('dialog form').trigger('submit');
  await flushPromises();
  expect(page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-row').slice(1).map(row => row.text()))
    .toEqual(['Zebra', 'Alpha']);
  await page.get('nav[aria-label="Cây thư mục"] .tree-button').trigger('click');
  expect(page.findAll('.child-folder-card').map(card => card.text())).toEqual(['Zebra', 'Alpha']);
  page.unmount();
});

test('folder hierarchy remains navigable after reload and through keyboard menu', async () => {
  storedFolders = [
    { id: 'root', name: 'HSK', parent_id: null },
    { id: 'child', name: 'Bài 01', parent_id: 'root' },
  ];
  const first = mount(App, { attachTo: document.body });
  await flushPromises();
  await first.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!.trigger('click');
  expect(first.get('nav[aria-label="Cây thư mục"]').text()).toContain('Bài 01');
  first.unmount();

  const reopened = mount(App, { attachTo: document.body });
  await flushPromises();
  const sidebar = reopened.get('nav[aria-label="Cây thư mục"]');
  expect(sidebar.text()).not.toContain('Bài 01');
  await sidebar.findAll('.tree-button')[1]!.trigger('click');
  const child = sidebar.findAll('.tree-button').find(button => button.text().includes('Bài 01'))!;
  await child.trigger('keydown', { key: 'ContextMenu' });
  await flushPromises();
  expect(reopened.get('[role="menu"]').text()).toContain('Bài 01');
  reopened.unmount();
});

test('learner creates a Word or Phrase from a folder menu', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }];
  api.createItem.mockImplementation(async payload => {
    const item: SavedLearningItem = { id: 'new-word', ...payload, pinyin: 'xué xí', created_at: 1700000000000, linked_item_ids: [] };
    storedItems.push(item);
    return item;
  });
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Tùy chọn HSK"]').trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Thêm')!.trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Từ / cụm từ')!.trigger('click');
  await page.get('#new-item-text').setValue('学习');
  await page.get('#new-item-meaning').setValue('học');
  await page.get('.new-item-editor form').trigger('submit');
  await flushPromises();
  expect(api.createItem).toHaveBeenCalledWith({ folder_id: 'f1', category: 'word', text: '学习', meaning: 'học' });
  expect(page.get('#learning-item-new-word').text()).toContain('xué xí');
  page.unmount();
});

test('learner can correct a Word or Phrase meaning suggestion before saving', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }];
  api.suggestMeaning.mockResolvedValue({ meaning: 'học tập' });
  api.createItem.mockImplementation(async payload => ({ id: 'new-word', ...payload, pinyin: 'xué xí', created_at: 1700000000000, linked_item_ids: [] }));
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Tùy chọn HSK"]').trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Thêm')!.trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Từ / cụm từ')!.trigger('click');
  await page.get('#new-item-text').setValue('学习');
  await page.get('#new-item-text').trigger('change');
  await flushPromises();
  expect((page.get('#new-item-meaning').element as HTMLInputElement).value).toBe('học tập');
  await page.get('#new-item-meaning').setValue('học');
  await page.get('.new-item-editor form').trigger('submit');
  await flushPromises();
  expect(api.createItem).toHaveBeenCalledWith({ folder_id: 'f1', category: 'word', text: '学习', meaning: 'học' });
  page.unmount();
});

test('new Word or Phrase form clears an unfinished meaning suggestion', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }];
  let finishSuggestion!: (value: { meaning: string }) => void;
  api.suggestMeaning.mockImplementation(() => new Promise(resolve => { finishSuggestion = resolve; }));
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Tùy chọn HSK"]').trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Thêm')!.trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Từ / cụm từ')!.trigger('click');
  await page.get('#new-item-text').setValue('学习');
  await page.get('#new-item-text').trigger('change');
  expect(page.get('.new-item-editor [role="status"]').text()).toContain('Đang gợi ý');
  await page.get('.new-item-editor .plain-button').trigger('click');
  await page.get('button[aria-label="Tùy chọn HSK"]').trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Thêm')!.trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Từ / cụm từ')!.trigger('click');
  expect(page.find('.new-item-editor [role="status"]').exists()).toBe(false);
  finishSuggestion({ meaning: 'học tập' });
  await flushPromises();
  page.unmount();
});

test('learner creates a standalone Sentence from a folder context menu', async () => {
  storedFolders = [{ id: 'f1', name: 'Bài học', parent_id: null }];
  api.createItem.mockImplementation(async payload => {
    const item: SavedLearningItem = { id: 'new-sentence', ...payload, pinyin: 'wǒ xǐ huān xué xí zhōng wén', created_at: 1700000000000, linked_item_ids: [] };
    storedItems.push(item);
    return item;
  });
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  const folderButton = page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!;
  await folderButton.trigger('contextmenu', { clientX: 30, clientY: 30 });
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Thêm')!.trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Câu')!.trigger('click');
  expect(page.get('#new-item-text').element.tagName).toBe('TEXTAREA');
  await page.get('.new-item-editor .plain-button').trigger('click');
  expect(api.createItem).not.toHaveBeenCalled();

  await folderButton.trigger('contextmenu', { clientX: 30, clientY: 30 });
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Thêm')!.trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Câu')!.trigger('click');
  await page.get('#new-item-text').setValue('我喜欢学习中文。');
  await page.get('#new-item-meaning').setValue('Tôi thích học tiếng Trung.');
  await page.get('.new-item-editor form').trigger('submit');
  await flushPromises();
  expect(api.createItem).toHaveBeenCalledWith({ folder_id: 'f1', category: 'sentence', text: '我喜欢学习中文。', meaning: 'Tôi thích học tiếng Trung.' });
  expect(page.get('#learning-item-new-sentence').text()).toContain('我喜欢学习中文。');
  page.unmount();
});

test('duplicate Word or Phrase stays in the form with a clear message', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }];
  api.createItem.mockRejectedValue(new ApiError(409, 'Duplicate Learning Item'));
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Tùy chọn HSK"]').trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Thêm')!.trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Từ / cụm từ')!.trigger('click');
  await page.get('#new-item-text').setValue('学习');
  await page.get('#new-item-meaning').setValue('học');
  await page.get('.new-item-editor form').trigger('submit');
  await flushPromises();
  expect(page.get('.new-item-editor[open] [role="alert"]').text()).toContain('đã có trong thư mục');
  page.unmount();
});

test('learner can add an item from a child folder card', async () => {
  storedFolders = [
    { id: 'root', name: 'HSK', parent_id: null },
    { id: 'child', name: 'Bài 01', parent_id: 'root' },
  ];
  api.createItem.mockImplementation(async payload => {
    const item: SavedLearningItem = { id: 'child-word', ...payload, pinyin: 'nǐ hǎo', created_at: 1700000000000, linked_item_ids: [] };
    storedItems.push(item);
    return item;
  });
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('nav[aria-label="Cây thư mục"]').findAll('.tree-button')[1]!.trigger('click');
  await page.get('.child-folder-card').trigger('contextmenu', { clientX: 100, clientY: 100 });
  expect(page.get('[role="menu"]').text()).toContain('Thêm');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Thêm')!.trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Từ / cụm từ')!.trigger('click');
  await page.get('#new-item-text').setValue('你好');
  await page.get('#new-item-meaning').setValue('xin chào');
  await page.get('.new-item-editor form').trigger('submit');
  await flushPromises();
  expect(api.createItem).toHaveBeenCalledWith({ folder_id: 'child', category: 'word', text: '你好', meaning: 'xin chào' });
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

test('learner manages cross-folder Learning Links from item editor', async () => {
  storedFolders = [{ id: 'f1', name: 'Words', parent_id: null }, { id: 'f2', name: 'Sentences', parent_id: null }];
  storedItems = [
    { id: 'w1', folder_id: 'f1', category: 'word', text: '学习', meaning: 'học', pinyin: '', created_at: 1, linked_item_ids: [] },
    { id: 's1', folder_id: 'f2', category: 'sentence', text: '天气好。', meaning: 'Trời đẹp.', pinyin: '', created_at: 2, linked_item_ids: [] },
  ];
  api.addItemLink.mockImplementation(async (id, linkedId) => {
    storedItems.find(entry => entry.id === id)!.linked_item_ids.push(linkedId);
    storedItems.find(entry => entry.id === linkedId)!.linked_item_ids.push(id);
  });
  api.removeItemLink.mockImplementation(async (id, linkedId) => {
    for (const entry of storedItems) entry.linked_item_ids = entry.linked_item_ids.filter(value => value !== id && value !== linkedId);
  });
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Sửa 学习"]').trigger('click');
  await page.get('#item-link-target').setValue('s1');
  await page.get('button[aria-label="Thêm liên kết"]').trigger('click');
  await flushPromises();
  expect(page.get('.item-editor').text()).toContain('天气好。');
  await page.get('button[aria-label="Gỡ liên kết 天气好。"]').trigger('click');
  await flushPromises();
  expect(page.find('button[aria-label="Gỡ liên kết 天气好。"]').exists()).toBe(false);
  page.unmount();
});

test('word form drafts multiple new and existing Example Sentences until save', async () => {
  storedFolders = [{ id: 'f1', name: 'Words', parent_id: null }, { id: 'f2', name: 'Sentences', parent_id: null }];
  storedItems = [{ id: 's1', folder_id: 'f2', category: 'sentence', text: '你好。', meaning: 'Xin chào.', pinyin: '', created_at: 1, linked_item_ids: [] }];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Tùy chọn Words"]').trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Thêm')!.trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Từ / cụm từ')!.trigger('click');
  await page.get('#new-item-text').setValue('你');
  await page.get('#new-item-meaning').setValue('bạn');
  await page.get('#new-item-tab-examples').trigger('click');
  expect(page.get('#new-item-tab-examples').attributes('aria-selected')).toBe('true');
  await page.get('#example-text').setValue('你好吗？');
  await page.get('#example-meaning').setValue('Bạn khỏe không?');
  await page.get('button[aria-label="Thêm câu mới"]').trigger('click');
  await page.get('#example-existing').setValue('s1');
  await page.get('button[aria-label="Chọn câu đã lưu"]').trigger('click');
  expect(page.get('.new-item-tab-count').text()).toBe('2');
  await page.get('#new-item-tab-main').trigger('click');
  expect((page.get('#new-item-text').element as HTMLInputElement).value).toBe('你');
  await page.get('#new-item-tab-examples').trigger('click');
  expect(api.createItemWithExamples).not.toHaveBeenCalled();
  await page.get('.new-item-editor form').trigger('submit');
  await flushPromises();
  expect(api.createItemWithExamples).toHaveBeenCalledWith({ item: { folder_id: 'f1', category: 'word', text: '你', meaning: 'bạn' }, examples: [{ text: '你好吗？', meaning: 'Bạn khỏe không?' }, { item_id: 's1' }] });
  page.unmount();
});

test('the two-tab form returns to missing main content before saving', async () => {
  storedFolders = [{ id: 'f1', name: 'Words', parent_id: null }];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Tùy chọn Words"]').trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Thêm')!.trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Từ / cụm từ')!.trigger('click');
  expect(page.get('#new-item-tab-main').attributes('aria-selected')).toBe('true');
  await page.get('#new-item-tab-main').trigger('keydown', { key: 'ArrowRight' });
  expect(page.get('#new-item-tab-examples').attributes('aria-selected')).toBe('true');
  await page.get('.new-item-editor form').trigger('submit');
  await flushPromises();
  expect(api.createItem).not.toHaveBeenCalled();
  expect(page.get('#new-item-tab-main').attributes('aria-selected')).toBe('true');
  expect(page.get('.new-item-editor [role="alert"]').text()).toContain('Nhập nội dung chính');
  page.unmount();
});

test('learner creates Grammar without Pinyin and filters it in folder', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }];
  api.createItem.mockImplementation(async body => {
    const created = { id: 'g1', ...body, pinyin: '', created_at: 3, linked_item_ids: [] };
    storedItems.push(created);
    return created;
  });
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Tùy chọn HSK"]').trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Thêm')!.trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Ngữ pháp')!.trigger('click');
  expect(page.get('.new-item-tabs').findAll('[role="tab"]')).toHaveLength(2);
  expect(page.get('#new-item-text').element.tagName).toBe('TEXTAREA');
  expect(page.get('#new-item-meaning').element.tagName).toBe('TEXTAREA');
  await page.get('#new-item-text').setValue('把 + đồ vật\n+ động từ');
  await page.get('#new-item-meaning').setValue('Chuyển đồ vật\nNhấn mạnh kết quả');
  await page.get('.new-item-editor form').trigger('submit');
  await flushPromises();
  expect(api.createItem).toHaveBeenCalledWith({ folder_id: 'f1', category: 'grammar', text: '把 + đồ vật\n+ động từ', meaning: 'Chuyển đồ vật\nNhấn mạnh kết quả' });
  expect(page.get('#learning-item-g1').text()).toContain('把 + đồ vật');
  expect(page.get('#learning-item-g1').get('.multiline-content').element.textContent).toContain('\n');
  await page.findAll('button').find(button => button.attributes('aria-label') === 'Sửa 把 + đồ vật\n+ động từ')!.trigger('click');
  expect(page.get('#item-text').element.tagName).toBe('TEXTAREA');
  expect(page.get('#item-meaning').element.tagName).toBe('TEXTAREA');
  expect(page.get('#learning-item-g1').find('.saved-item-pinyin').exists()).toBe(false);
  expect(page.get('.breadcrumb-count').text()).toContain('0 từ · 0 câu');
  await page.get('select[aria-label="Lọc mục học tập"]').setValue('grammar');
  expect(page.find('#learning-item-g1').exists()).toBe(true);
  page.unmount();
});

test('learner creates Note with multiline body from visible folder menu', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }];
  api.createItem.mockImplementation(async body => {
    const created = { id: 'n1', ...body, pinyin: '', created_at: 3, linked_item_ids: [] };
    storedItems.push(created);
    return created;
  });
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Tùy chọn HSK"]').trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Thêm')!.trigger('click');
  await page.findAll('[role="menuitem"]').find(button => button.text() === 'Ghi chú')!.trigger('click');
  await page.get('#new-item-text').setValue('Nhắc nhớ');
  await page.get('#new-item-meaning').setValue('Dòng 1\n**Dòng 2**');
  await page.get('.new-item-editor form').trigger('submit');
  await flushPromises();
  expect(page.get('#learning-item-n1').text()).toContain('Dòng 1\n**Dòng 2**');
  expect(page.get('#learning-item-n1').find('.saved-item-pinyin').exists()).toBe(false);
  expect(page.get('#learning-item-n1').find('strong').exists()).toBe(false);
  page.unmount();
});

test('learner adds new Example Sentence while editing Grammar', async () => {
  storedFolders = [{ id: 'f1', name: 'HSK', parent_id: null }];
  storedItems = [{ id: 'g1', folder_id: 'f1', category: 'grammar', text: '把 + N', meaning: 'Mô tả', pinyin: '', created_at: 1, linked_item_ids: [] }];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Sửa 把 + N"]').trigger('click');
  await page.get('#edit-example-text').setValue('把门关上。');
  await page.get('#edit-example-meaning').setValue('Đóng cửa.');
  await page.get('button[aria-label="Thêm câu ví dụ vào bản nháp"]').trigger('click');
  expect(api.updateItemWithExamples).not.toHaveBeenCalled();
  await page.get('.item-editor form').trigger('submit');
  await flushPromises();
  expect(api.updateItemWithExamples).toHaveBeenCalledWith('g1', { item: { text: '把 + N', meaning: 'Mô tả', category: 'grammar', folder_id: 'f1' }, examples: [{ text: '把门关上。', meaning: 'Đóng cửa.' }] });
  page.unmount();
});

test('learner drafts existing cross-folder Example Sentence while editing Word or Phrase', async () => {
  storedFolders = [{ id: 'f1', name: 'Words', parent_id: null }, { id: 'f2', name: 'Sentences', parent_id: null }];
  storedItems = [
    { id: 'w1', folder_id: 'f1', category: 'word', text: '学习', meaning: 'học', pinyin: '', created_at: 1, linked_item_ids: [] },
    { id: 's1', folder_id: 'f2', category: 'sentence', text: '我学习。', meaning: 'Tôi học.', pinyin: '', created_at: 2, linked_item_ids: [] },
  ];
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  await page.get('button[aria-label="Sửa 学习"]').trigger('click');
  await page.get('#edit-example-existing').setValue('s1');
  await page.get('button[aria-label="Thêm câu đã lưu vào bản nháp"]').trigger('click');
  expect(api.addItemLink).not.toHaveBeenCalled();
  await page.get('.item-editor form').trigger('submit');
  await flushPromises();
  expect(api.updateItemWithExamples).toHaveBeenCalledWith('w1', { item: { text: '学习', meaning: 'học', category: 'word', folder_id: 'f1' }, examples: [{ item_id: 's1' }] });
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
    'Tạo thư mục con', 'Đổi tên', 'Chuyển thư mục', 'Thêm', 'Xóa thư mục',
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
  await page.get('button[aria-label="Mở thư mục Bài 01"]').trigger('click');
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
  expect(page.find('.link-banner').exists()).toBe(false);
  expect(window.location.search).toBe('');
  page.unmount();
});

test('folder location and child grid count only items at selected level', async () => {
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
  expect(page.get('.child-folder-grid').text()).toContain('Bài 1');
  await page.get('button[aria-label="Mở thư mục Bài 1"]').trigger('click');
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
  await page.get('button[aria-label="Mở thư mục Bài 1"]').trigger('click');
  expect(page.get('nav[aria-label="Đường dẫn thư mục"] [aria-label="Thống kê vị trí hiện tại"]').text()).toBe('(0 từ · 1 câu)');
  expect(page.find('.child-folder-grid').exists()).toBe(false);
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
