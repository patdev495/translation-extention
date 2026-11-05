// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import App from './App.vue';
import { learningApi, type LearningFolder } from './api';

vi.mock('./api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api')>();
  return {
    ...original,
    learningApi: {
      me: vi.fn(), register: vi.fn(), login: vi.fn(), logout: vi.fn(),
      approveLink: vi.fn(), folders: vi.fn(), createFolder: vi.fn(), updateFolder: vi.fn(),
    },
  };
});

const api = vi.mocked(learningApi);
let storedFolders: LearningFolder[];

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  storedFolders = [];
  vi.clearAllMocks();
  api.me.mockResolvedValue({ id: 'person-1', username: 'learner' });
  api.folders.mockImplementation(async () => [...storedFolders]);
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

afterEach(() => vi.restoreAllMocks());

test('creates, browses, renames and moves a nested folder through the website', async () => {
  const page = mount(App, { attachTo: document.body });
  await flushPromises();
  expect(page.text()).toContain('Mỗi hành trình bắt đầu từ một thư mục');

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
    'Tạo thư mục con', 'Đổi tên', 'Chuyển thư mục',
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
  await page.get('button[aria-label="Đổi tên Bài 01"]').trigger('click');
  await page.get('#folder-name').setValue('Bài 02');
  await page.get('dialog form').trigger('submit');
  await flushPromises();
  expect(api.updateFolder).toHaveBeenCalledWith('folder-2', { name: 'Bài 02' });

  await page.get('button[aria-label="Chuyển Bài 02"]').trigger('click');
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
