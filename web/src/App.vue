<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ArrowRight, BookOpen, Check, ChevronRight, Ellipsis, Folder, FolderPlus, Home, Link2, LogOut, MoveRight, Pencil, RotateCcw, Sparkles, Trash2 } from '@lucide/vue';
import { ApiError, learningApi, type Account, type ExampleSentenceDraft, type LearningFolder, type SavedLearningItem, type TrashEntry } from './api';

type EditorMode = 'create' | 'rename' | 'move';

interface TreeRow {
  folder: LearningFolder;
  depth: number;
}

interface FolderContextMenu {
  folderId: string | null;
  left: number;
  top: number;
}

interface CardFields { vietnamese: boolean; chinese: boolean; pinyin: boolean }
const CARD_FIELDS_KEY = 'polylearn.card-fields.v1';

function savedCardFields(): CardFields {
  const defaults = { vietnamese: true, chinese: true, pinyin: true };
  try {
    const saved = JSON.parse(window.localStorage.getItem(CARD_FIELDS_KEY) ?? 'null') as Partial<CardFields> | null;
    if (!saved || typeof saved !== 'object') return defaults;
    return {
      vietnamese: typeof saved.vietnamese === 'boolean' ? saved.vietnamese : true,
      chinese: typeof saved.chinese === 'boolean' ? saved.chinese : true,
      pinyin: typeof saved.pinyin === 'boolean' ? saved.pinyin : true,
    };
  } catch { return defaults; }
}

const account = ref<Account | null>(null);
const accountLoading = ref(true);
const accountBusy = ref(false);
const accountMode = ref<'login' | 'register'>('login');
const username = ref('');
const password = ref('');
const accountError = ref('');
const folders = ref<LearningFolder[]>([]);
const foldersLoading = ref(false);
const folderError = ref('');
const items = ref<SavedLearningItem[]>([]);
const trash = ref<TrashEntry[]>([]);
const showTrash = ref(false);
const trashBusy = ref(false);
const feedback = ref('');
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
watch(feedback, (message) => {
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = message ? setTimeout(() => { feedback.value = ''; }, 5000) : undefined;
}, { flush: 'sync' });
const confirmDialog = ref<HTMLDialogElement | null>(null);
const confirmLabel = ref('');
const confirmSuccess = ref('');
let confirmedAction: (() => Promise<void>) | null = null;
const itemError = ref('');
const itemEditor = ref<HTMLDialogElement | null>(null);
const linkedItemsDialog = ref<HTMLDialogElement | null>(null);
const linkedSourceId = ref<string | null>(null);
const editingItem = ref<SavedLearningItem | null>(null);
const editText = ref('');
const editMeaning = ref('');
const editCategory = ref<SavedLearningItem['category']>('word');
const editFolderId = ref('');
const editLinkTarget = ref('');
const editExampleText = ref('');
const editExampleMeaning = ref('');
const editExampleExisting = ref('');
const editExampleDrafts = ref<ExampleSentenceDraft[]>([]);
const editExampleCandidates = computed(() => items.value.filter(entry => entry.category === 'sentence' && !editingItem.value?.linked_item_ids.includes(entry.id) && !editExampleDrafts.value.some(draft => 'item_id' in draft && draft.item_id === entry.id)));
function addEditExample(): void {
  if (!editExampleText.value.trim() || !editExampleMeaning.value.trim()) return;
  editExampleDrafts.value.push({ text: editExampleText.value.trim(), meaning: editExampleMeaning.value.trim() });
  editExampleText.value = '';
  editExampleMeaning.value = '';
}
function addEditExistingExample(): void {
  if (!editExampleExisting.value) return;
  editExampleDrafts.value.push({ item_id: editExampleExisting.value });
  editExampleExisting.value = '';
}
const itemBusy = ref(false);
const newItemEditor = ref<HTMLDialogElement | null>(null);
const newItemCategory = ref<SavedLearningItem['category']>('word');
const newItemFolderId = ref('');
const newItemText = ref('');
const newItemMeaning = ref('');
const newItemMeaningUserEdited = ref(false);
const newItemSuggestionBusy = ref(false);
const newItemSuggestionError = ref('');
let suggestionVersion = 0;
const newItemBusy = ref(false);
const newItemError = ref('');
const exampleText = ref('');
const exampleMeaning = ref('');
const exampleExisting = ref('');
const exampleDrafts = ref<ExampleSentenceDraft[]>([]);
const exampleCandidates = computed(() => items.value.filter(entry => entry.category === 'sentence' && !exampleDrafts.value.some(draft => 'item_id' in draft && draft.item_id === entry.id)));
function addNewExample(): void {
  if (!exampleText.value.trim() || !exampleMeaning.value.trim()) return;
  exampleDrafts.value.push({ text: exampleText.value.trim(), meaning: exampleMeaning.value.trim() });
  exampleText.value = '';
  exampleMeaning.value = '';
}
function addExistingExample(): void {
  if (!exampleExisting.value) return;
  exampleDrafts.value.push({ item_id: exampleExisting.value });
  exampleExisting.value = '';
}
function exampleLabel(draft: ExampleSentenceDraft): string {
  return 'item_id' in draft ? itemById.value.get(draft.item_id)?.text ?? '' : draft.text;
}
const focusedItemId = ref<string | null>(null);
const selectedId = ref<string | null>(null);
const expandedFolderIds = ref<Set<string>>(new Set());
const categoryFilter = ref<'all' | SavedLearningItem['category']>('all');
const cardFields = ref<CardFields>(savedCardFields());
const displayOptions = ref<HTMLDetailsElement | null>(null);
watch(cardFields, (fields) => {
  try { window.localStorage.setItem(CARD_FIELDS_KEY, JSON.stringify(fields)); } catch { /* Storage may be unavailable. */ }
}, { deep: true });
const sortOrder = ref<'newest' | 'oldest'>('newest');
const page = ref(1);
const PAGE_SIZE = 20;
const folderContextMenu = ref<FolderContextMenu | null>(null);
const showAddChoices = ref(false);
const addSubmenuLeft = ref(false);
const addSubmenuAbove = ref(false);
const folderContextMenuElement = ref<HTMLElement | null>(null);
let folderMenuCloseTimer: ReturnType<typeof setTimeout> | undefined;
const editor = ref<HTMLDialogElement | null>(null);
const editorMode = ref<EditorMode>('create');
const editorTarget = ref<string | null>(null);
const editorName = ref('');
const editorParentId = ref<string | null>(null);
const editorBusy = ref(false);
const editorError = ref('');
const editorInput = ref<HTMLInputElement | null>(null);
const linkRequest = new URLSearchParams(window.location.search).get('link');
const linkBusy = ref(false);
const linkMessage = ref('');
const linkApproved = ref(false);

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Đã có lỗi xảy ra. Hãy thử lại.';
  const messages: Record<string, string> = {
    'Username already registered': 'Tên đăng nhập này đã được sử dụng.',
    'Username or password is incorrect': 'Tên đăng nhập hoặc mật khẩu chưa đúng.',
    'Folder name already used here': 'Tên thư mục đã tồn tại ở vị trí này.',
    'Parent folder not found': 'Không tìm thấy thư mục cha.',
    'Folder not found': 'Không tìm thấy thư mục.',
    'Cannot move folder into itself or a descendant': 'Không thể chuyển thư mục vào chính nó hoặc thư mục con.',
    'Link request expired or unavailable': 'Yêu cầu liên kết đã hết hạn. Hãy bắt đầu lại từ extension.',
    'Duplicate Learning Item': 'Mục này đã có trong thư mục. Hãy sửa mục đã lưu hoặc chọn thư mục khác.',
  };
  return messages[error.message] ?? error.message;
}

async function loadFolders(): Promise<void> {
  foldersLoading.value = true;
  folderError.value = '';
  try {
    folders.value = await learningApi.folders();
    items.value = await learningApi.items();
    if (selectedId.value && !folders.value.some((folder) => folder.id === selectedId.value)) {
      selectedId.value = null;
    }
  } catch (error) {
    folderError.value = errorMessage(error);
  } finally {
    foldersLoading.value = false;
  }
}

async function loadTrash(): Promise<void> {
  trash.value = await learningApi.trash();
}

async function openTrash(): Promise<void> {
  showTrash.value = true;
  selectedId.value = null;
  try { await loadTrash(); } catch (error) { feedback.value = errorMessage(error); }
}

function openLibrary(folderId: string | null): void {
  showTrash.value = false;
  selectedId.value = folderId;
  if (folderId) {
    const expanded = new Set(expandedFolderIds.value);
    let current: string | null = folderId;
    while (current) {
      expanded.add(current);
      current = folders.value.find(folder => folder.id === current)?.parent_id ?? null;
    }
    expandedFolderIds.value = expanded;
  }
}

function openSidebarFolder(folderId: string): void {
  showTrash.value = false;
  selectedId.value = folderId;
  const expanded = new Set(expandedFolderIds.value);
  if (expanded.has(folderId)) expanded.delete(folderId);
  else expanded.add(folderId);
  expandedFolderIds.value = expanded;
}

function askToDelete(label: string, action: () => Promise<void>, success: string): void {
  confirmLabel.value = label;
  confirmSuccess.value = success;
  confirmedAction = action;
  confirmDialog.value?.showModal();
}

async function confirmDeletion(): Promise<void> {
  if (!confirmedAction || trashBusy.value) return;
  trashBusy.value = true;
  feedback.value = '';
  try {
    await confirmedAction();
    await loadFolders();
    await loadTrash();
    feedback.value = confirmSuccess.value;
    confirmDialog.value?.close();
  } catch (error) { feedback.value = errorMessage(error); }
  finally { trashBusy.value = false; }
}

async function restoreEntry(entry: TrashEntry): Promise<void> {
  trashBusy.value = true;
  feedback.value = '';
  try {
    const restored = entry.kind === 'item'
      ? await learningApi.restoreItem(entry.id)
      : await learningApi.restoreFolder(entry.id);
    await loadFolders();
    await loadTrash();
    const destination = entry.kind === 'item' && 'folder_id' in restored && restored.folder_id !== entry.folder_id
      ? folders.value.find(folder => folder.id === restored.folder_id)?.name
      : null;
    feedback.value = destination
      ? `Đã khôi phục “${entry.name}” vào “${destination}” vì thư mục cũ không còn.`
      : `Đã khôi phục “${entry.name}”.`;
  } catch (error) { feedback.value = errorMessage(error); }
  finally { trashBusy.value = false; }
}

onMounted(async () => {
  try {
    account.value = await learningApi.me();
    await loadFolders();
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) {
      accountError.value = errorMessage(error);
    }
  } finally {
    accountLoading.value = false;
  }
});

function closeFolderContextMenu(): void {
  if (folderMenuCloseTimer) clearTimeout(folderMenuCloseTimer);
  folderMenuCloseTimer = undefined;
  folderContextMenu.value = null;
  showAddChoices.value = false;
}

function cancelFolderMenuClose(): void {
  if (folderMenuCloseTimer) clearTimeout(folderMenuCloseTimer);
  folderMenuCloseTimer = undefined;
}

function scheduleFolderMenuClose(): void {
  cancelFolderMenuClose();
  folderMenuCloseTimer = setTimeout(closeFolderContextMenu, 180);
}

function dismissFolderContextMenu(event: PointerEvent): void {
  if (folderContextMenuElement.value && !folderContextMenuElement.value.contains(event.target as Node)) {
    closeFolderContextMenu();
  }
  if (displayOptions.value && !displayOptions.value.contains(event.target as Node)) displayOptions.value.open = false;
}

function handleContextMenuEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeFolderContextMenu();
  if (event.key === 'Escape' && displayOptions.value) displayOptions.value.open = false;
}

onMounted(() => {
  document.addEventListener('pointerdown', dismissFolderContextMenu);
  document.addEventListener('keydown', handleContextMenuEscape);
  window.addEventListener('resize', closeFolderContextMenu);
  window.addEventListener('scroll', closeFolderContextMenu, true);
});

onUnmounted(() => {
  cancelFolderMenuClose();
  if (feedbackTimer) clearTimeout(feedbackTimer);
  document.removeEventListener('pointerdown', dismissFolderContextMenu);
  document.removeEventListener('keydown', handleContextMenuEscape);
  window.removeEventListener('resize', closeFolderContextMenu);
  window.removeEventListener('scroll', closeFolderContextMenu, true);
});

async function submitAccount(): Promise<void> {
  accountBusy.value = true;
  accountError.value = '';
  try {
    account.value = accountMode.value === 'login'
      ? await learningApi.login(username.value, password.value)
      : await learningApi.register(username.value, password.value);
    password.value = '';
    await loadFolders();
  } catch (error) {
    accountError.value = errorMessage(error);
  } finally {
    accountBusy.value = false;
  }
}

async function signOut(): Promise<void> {
  accountBusy.value = true;
  folderError.value = '';
  try {
    await learningApi.logout();
    account.value = null;
    username.value = '';
    password.value = '';
    folders.value = [];
    items.value = [];
    trash.value = [];
    showTrash.value = false;
    selectedId.value = null;
    linkApproved.value = false;
  } catch (error) {
    folderError.value = errorMessage(error);
  } finally {
    accountBusy.value = false;
  }
}

async function approveLink(): Promise<void> {
  if (!linkRequest) return;
  linkBusy.value = true;
  linkMessage.value = '';
  try {
    await learningApi.approveLink(linkRequest);
    linkApproved.value = true;
    linkMessage.value = 'Đã liên kết. Quay lại extension để xem trạng thái tài khoản.';
  } catch (error) {
    linkMessage.value = errorMessage(error);
  } finally {
    linkBusy.value = false;
  }
}

const folderById = computed(() => new Map(folders.value.map((folder) => [folder.id, folder])));
const selectedFolder = computed(() => selectedId.value ? folderById.value.get(selectedId.value) ?? null : null);
const visibleItems = computed(() => selectedId.value ? items.value.filter(item => item.folder_id === selectedId.value) : items.value);
const itemById = computed(() => new Map(items.value.map(item => [item.id, item])));
const linkedSource = computed(() => linkedSourceId.value ? itemById.value.get(linkedSourceId.value) ?? null : null);
const linkedEntries = computed(() => (linkedSource.value?.linked_item_ids ?? [])
  .map(id => itemById.value.get(id))
  .filter((entry): entry is SavedLearningItem => Boolean(entry)));
function linkedKind(entry: SavedLearningItem): string {
  if (entry.category !== 'sentence') return 'câu';
  return entry.linked_item_ids.some(id => itemById.value.get(id)?.category === 'grammar') ? 'mục' : 'từ';
}
const filteredItems = computed(() => categoryFilter.value === 'all'
  ? visibleItems.value
  : visibleItems.value.filter(item => item.category === categoryFilter.value));
const sortedItems = computed(() => [...filteredItems.value].sort((a, b) => {
  const difference = sortOrder.value === 'newest' ? b.created_at - a.created_at : a.created_at - b.created_at;
  return difference || a.id.localeCompare(b.id);
}));
const pageCount = computed(() => Math.max(1, Math.ceil(sortedItems.value.length / PAGE_SIZE)));
const currentPage = computed(() => Math.min(page.value, pageCount.value));
const pagedItems = computed(() => sortedItems.value.slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE));
watch(selectedId, () => { page.value = 1; categoryFilter.value = 'all'; }, { flush: 'sync' });
watch([sortOrder, categoryFilter], () => { page.value = 1; }, { flush: 'sync' });

interface FolderStats { words: number; sentences: number }
const folderStats = computed(() => {
  const counts = new Map<string, FolderStats>();
  for (const folder of folders.value) counts.set(folder.id, { words: 0, sentences: 0 });
  for (const entry of items.value) {
    const count = counts.get(entry.folder_id);
    if (count) {
      if (entry.category === 'word') count.words += 1;
      else if (entry.category === 'sentence') count.sentences += 1;
    }
  }
  return counts;
});
const currentStats = computed<FolderStats>(() => selectedId.value
  ? folderStats.value.get(selectedId.value) ?? { words: 0, sentences: 0 }
  : { words: items.value.filter(item => item.category === 'word').length,
      sentences: items.value.filter(item => item.category === 'sentence').length });

function formatAddedAt(value: number): string {
  const milliseconds = value < 100_000_000_000 ? value * 1000 : value;
  return new Date(milliseconds).toLocaleDateString('vi-VN');
}

async function openItemEditor(item: SavedLearningItem): Promise<void> {
  editingItem.value = item;
  editText.value = item.text;
  editMeaning.value = item.meaning;
  editCategory.value = item.category;
  editFolderId.value = item.folder_id;
  editLinkTarget.value = '';
  editExampleText.value = '';
  editExampleMeaning.value = '';
  editExampleExisting.value = '';
  editExampleDrafts.value = [];
  itemError.value = '';
  itemEditor.value?.showModal();
  await nextTick();
  itemEditor.value?.querySelector('input')?.focus();
}

const editLinkedItems = computed(() => editingItem.value?.linked_item_ids.map(id => itemById.value.get(id)).filter((entry): entry is SavedLearningItem => !!entry) ?? []);
const editLinkCandidates = computed(() => items.value.filter(entry => editingItem.value && entry.id !== editingItem.value.id
  && !editingItem.value.linked_item_ids.includes(entry.id)
  && (editingItem.value.category === 'sentence' ? entry.category === 'word' || entry.category === 'grammar' : entry.category === 'sentence')));
async function changeItemLink(targetId: string, remove = false): Promise<void> {
  if (!editingItem.value || !targetId) return;
  itemError.value = '';
  try {
    if (remove) await learningApi.removeItemLink(editingItem.value.id, targetId);
    else await learningApi.addItemLink(editingItem.value.id, targetId);
    items.value = await learningApi.items();
    const refreshed = items.value.find(entry => entry.id === editingItem.value?.id);
    editingItem.value = refreshed ? { ...refreshed, linked_item_ids: [...refreshed.linked_item_ids] } : null;
    editLinkTarget.value = '';
  } catch (error) { itemError.value = errorMessage(error); }
}

async function saveItem(): Promise<void> {
  if (!editingItem.value) return;
  itemBusy.value = true;
  itemError.value = '';
  try {
    const item = {
      text: editText.value.trim(), meaning: editMeaning.value.trim(), category: editCategory.value, folder_id: editFolderId.value,
    };
    if (editExampleDrafts.value.length) await learningApi.updateItemWithExamples(editingItem.value.id, { item, examples: editExampleDrafts.value });
    else await learningApi.updateItem(editingItem.value.id, item);
    items.value = await learningApi.items();
    itemEditor.value?.close();
  } catch (error) {
    itemError.value = errorMessage(error);
  } finally { itemBusy.value = false; }
}

function followItem(id: string): void {
  const target = itemById.value.get(id);
  if (!target) return;
  openLibrary(target.folder_id);
  categoryFilter.value = 'all';
  const index = sortedItems.value.findIndex(item => item.id === id);
  page.value = Math.floor(Math.max(0, index) / PAGE_SIZE) + 1;
  focusedItemId.value = id;
  void nextTick(() => document.getElementById(`learning-item-${id}`)?.focus());
}

function openLinkedItems(item: SavedLearningItem): void {
  linkedSourceId.value = item.id;
  linkedItemsDialog.value?.showModal();
}

function closeLinkedItems(): void {
  linkedItemsDialog.value?.close();
  linkedSourceId.value = null;
}

function followLinkedItem(id: string): void {
  closeLinkedItems();
  followItem(id);
}

async function editLinkedItem(item: SavedLearningItem): Promise<void> {
  closeLinkedItems();
  await openItemEditor(item);
}
const currentChildren = computed(() => folders.value
  .filter((folder) => folder.parent_id === selectedId.value));

const treeRows = computed<TreeRow[]>(() => {
  const result: TreeRow[] = [];
  const visit = (parentId: string | null, depth: number): void => {
    folders.value
      .filter((folder) => folder.parent_id === parentId)
      .forEach((folder) => {
        result.push({ folder, depth });
        if (expandedFolderIds.value.has(folder.id)) visit(folder.id, depth + 1);
      });
  };
  visit(null, 0);
  return result;
});

const breadcrumbs = computed<LearningFolder[]>(() => {
  const path: LearningFolder[] = [];
  let current = selectedFolder.value;
  while (current) {
    path.unshift(current);
    current = current.parent_id ? folderById.value.get(current.parent_id) ?? null : null;
  }
  return path;
});

function descendantIds(folderId: string): Set<string> {
  const ids = new Set<string>([folderId]);
  const walk = (parentId: string): void => {
    for (const folder of folders.value.filter((entry) => entry.parent_id === parentId)) {
      ids.add(folder.id);
      walk(folder.id);
    }
  };
  walk(folderId);
  return ids;
}

const moveDestinations = computed(() => {
  if (!editorTarget.value) return treeRows.value;
  const excluded = descendantIds(editorTarget.value);
  return treeRows.value.filter((row) => !excluded.has(row.folder.id));
});

async function showFolderContextMenu(folderId: string | null, x: number, y: number, focus = true): Promise<void> {
  cancelFolderMenuClose();
  folderContextMenu.value = { folderId, left: x, top: y };
  showAddChoices.value = false;
  await nextTick();
  const menu = folderContextMenuElement.value;
  if (!menu) return;
  const rect = menu.getBoundingClientRect();
  folderContextMenu.value = {
    folderId,
    left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
    top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
  };
  if (focus) menu.querySelector('button')?.focus();
}

function hoverFolderMenuFromButton(folderId: string | null, event: MouseEvent): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  void showFolderContextMenu(folderId, rect.right, rect.top, false);
}

function setAddChoices(open: boolean, event: Event): void {
  showAddChoices.value = open;
  if (!open) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  addSubmenuLeft.value = rect.right + 200 > window.innerWidth - 8;
  addSubmenuAbove.value = rect.top + 180 > window.innerHeight - 8;
}

function handleFolderContextKey(event: KeyboardEvent, folderId: string | null): void {
  if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
  event.preventDefault();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  void showFolderContextMenu(folderId, rect.left + 18, rect.bottom);
}

function openFolderMenuFromButton(folderId: string | null, event: MouseEvent): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  void showFolderContextMenu(folderId, rect.right, rect.top);
}

function chooseFolderContextAction(mode: EditorMode): void {
  const folderId = folderContextMenu.value?.folderId ?? null;
  closeFolderContextMenu();
  void openEditor(mode, folderId);
}

function startNewItem(category: SavedLearningItem['category']): void {
  const folderId = folderContextMenu.value?.folderId;
  if (!folderId) return;
  closeFolderContextMenu();
  newItemCategory.value = category;
  newItemFolderId.value = folderId;
  newItemText.value = '';
  newItemMeaning.value = '';
  newItemMeaningUserEdited.value = false;
  newItemSuggestionBusy.value = false;
  newItemSuggestionError.value = '';
  suggestionVersion += 1;
  newItemError.value = '';
  exampleDrafts.value = [];
  exampleText.value = '';
  exampleMeaning.value = '';
  exampleExisting.value = '';
  newItemEditor.value?.showModal();
}

async function requestMeaningSuggestion(): Promise<void> {
  const text = newItemText.value.trim();
  const version = ++suggestionVersion;
  if (newItemCategory.value !== 'word' || !text || newItemMeaningUserEdited.value) return;
  newItemSuggestionBusy.value = true;
  newItemSuggestionError.value = '';
  try {
    const result = await learningApi.suggestMeaning(text);
    if (version === suggestionVersion && !newItemMeaningUserEdited.value && newItemText.value.trim() === text) {
      newItemMeaning.value = result.meaning;
    }
  } catch {
    if (version === suggestionVersion) newItemSuggestionError.value = 'Chưa lấy được nghĩa gợi ý. Bạn có thể tự nhập.';
  } finally {
    if (version === suggestionVersion) newItemSuggestionBusy.value = false;
  }
}

async function submitNewItem(): Promise<void> {
  if (newItemBusy.value) return;
  newItemBusy.value = true;
  newItemError.value = '';
  try {
    const item = {
      folder_id: newItemFolderId.value,
      category: newItemCategory.value,
      text: newItemText.value.trim(),
      meaning: newItemMeaning.value.trim(),
    };
    if (exampleDrafts.value.length) await learningApi.createItemWithExamples({ item, examples: exampleDrafts.value });
    else await learningApi.createItem(item);
    await loadFolders();
    openLibrary(newItemFolderId.value);
    newItemEditor.value?.close();
  } catch (error) {
    newItemError.value = errorMessage(error);
  } finally {
    newItemBusy.value = false;
  }
}

function requestTrashFolder(): void {
  const folderId = folderContextMenu.value?.folderId;
  if (!folderId) return;
  const folderName = folderById.value.get(folderId)?.name ?? 'này';
  closeFolderContextMenu();
  askToDelete(`Chuyển thư mục “${folderName}” vào thùng rác?`, () => learningApi.trashFolder(folderId), 'Đã chuyển thư mục vào thùng rác.');
}

async function openEditor(mode: EditorMode, targetId: string | null = null): Promise<void> {
  editorMode.value = mode;
  editorTarget.value = targetId;
  editorError.value = '';
  const target = targetId ? folderById.value.get(targetId) : null;
  editorName.value = mode === 'rename' ? target?.name ?? '' : '';
  editorParentId.value = mode === 'create' ? targetId : target?.parent_id ?? null;
  editor.value?.showModal();
  await nextTick();
  editorInput.value?.focus();
}

function closeEditor(): void {
  editor.value?.close();
}

async function submitEditor(): Promise<void> {
  if (editorMode.value !== 'create' && !editorTarget.value) return;
  editorBusy.value = true;
  editorError.value = '';
  try {
    let createdFolderId: string | null = null;
    if (editorMode.value === 'create') {
      const folder = await learningApi.createFolder(editorName.value.trim(), editorParentId.value);
      createdFolderId = folder.id;
    } else if (editorMode.value === 'rename') {
      await learningApi.updateFolder(editorTarget.value!, { name: editorName.value.trim() });
    } else {
      await learningApi.updateFolder(editorTarget.value!, { parent_id: editorParentId.value });
    }
    await loadFolders();
    if (createdFolderId) openLibrary(createdFolderId);
    else if (editorMode.value === 'move' && selectedId.value) openLibrary(selectedId.value);
    closeEditor();
  } catch (error) {
    editorError.value = errorMessage(error);
  } finally {
    editorBusy.value = false;
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="PolyTranslate Learning - trang chủ">
        <span class="brand-mark"><BookOpen :size="21" :stroke-width="2.2" aria-hidden="true" /></span>
        <span>poly<span class="brand-accent">learn</span></span>
      </a>
      <div v-if="account" class="topbar-account">
        <span class="account-avatar" aria-hidden="true">{{ account.username.slice(0, 1).toUpperCase() }}</span>
        <span class="account-name">{{ account.username }}</span>
        <button class="icon-button" type="button" aria-label="Đăng xuất" title="Đăng xuất" :disabled="accountBusy" @click="signOut"><LogOut :size="18" /></button>
      </div>
    </header>

    <main v-if="accountLoading" class="loading-screen" role="status">Đang mở thư viện…</main>

    <main v-else-if="!account" class="auth-layout">
      <section class="auth-intro" aria-label="Giới thiệu PolyTranslate Learning">
        <div class="eyebrow"><Sparkles :size="16" aria-hidden="true" /> HỌC TỪ NHỮNG GÌ BẠN GẶP</div>
        <h1>Chữ mới hôm nay.<br /><span>Một nơi để nhớ.</span></h1>
        <p>Thư viện riêng cho từ, cụm từ và câu tiếng Trung bạn lưu bằng PolyTranslate. Tự xếp bài học theo cách của bạn.</p>
        <div class="intro-card"><span class="intro-glyph">学</span><div><strong>Học theo ngữ cảnh của bạn</strong><small>Tạo thư mục HSK, bài học hoặc chủ đề — mọi thứ sẵn sàng khi bạn quay lại.</small></div></div>
        <div class="color-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      </section>

      <section class="auth-card" aria-labelledby="auth-title">
        <div class="auth-card-icon"><BookOpen :size="25" aria-hidden="true" /></div>
        <p class="overline">POLYTRANSLATE LEARNING</p>
        <h2 id="auth-title">{{ accountMode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản học' }}</h2>
        <p class="auth-subtitle">{{ accountMode === 'login' ? 'Đăng nhập để mở thư viện của bạn.' : 'Bắt đầu sắp xếp những gì bạn học.' }}</p>
        <p v-if="linkRequest" class="link-hint"><Link2 :size="16" aria-hidden="true" /> Đăng nhập rồi xác nhận liên kết extension.</p>
        <form class="auth-form" @submit.prevent="submitAccount">
          <label for="username">Tên đăng nhập</label>
          <input id="username" v-model="username" type="text" autocomplete="username" :pattern="accountMode === 'register' ? '(?:[A-Za-z0-9_.]|-)+' : '(?:[A-Za-z0-9_.@]|-)+'" required placeholder="Ví dụ: hocvien_hsk1" />
          <label for="password">Mật khẩu</label>
          <input id="password" v-model="password" type="password" :autocomplete="accountMode === 'login' ? 'current-password' : 'new-password'" required placeholder="Nhập mật khẩu" />
          <p v-if="accountError" class="form-error" role="alert">{{ accountError }}</p>
          <button class="primary-button" type="submit" :disabled="accountBusy">{{ accountBusy ? 'Đang xử lý…' : accountMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản' }} <ArrowRight :size="18" aria-hidden="true" /></button>
        </form>
        <p class="auth-switch">{{ accountMode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?' }} <button type="button" @click="accountMode = accountMode === 'login' ? 'register' : 'login'; accountError = ''">{{ accountMode === 'login' ? 'Đăng ký' : 'Đăng nhập' }}</button></p>
      </section>
    </main>

    <main v-else class="workspace">
      <aside class="sidebar" aria-label="Thư mục học tập">
        <div class="sidebar-heading"><span>THƯ VIỆN</span></div>
        <nav aria-label="Cây thư mục">
          <div class="tree-row" :class="{ active: selectedId === null && !showTrash }"><button class="tree-button" :class="{ active: selectedId === null && !showTrash }" type="button" :aria-current="selectedId === null && !showTrash ? 'page' : undefined" @click="openLibrary(null)" @contextmenu.prevent="showFolderContextMenu(null, $event.clientX, $event.clientY)" @keydown="handleFolderContextKey($event, null)"><Home :size="17" aria-hidden="true" /> Tất cả thư mục</button><button class="tree-menu-button" type="button" aria-label="Tùy chọn Thư viện" title="Tùy chọn Thư viện" @mouseenter="hoverFolderMenuFromButton(null, $event)" @mouseleave="scheduleFolderMenuClose" @click="openFolderMenuFromButton(null, $event)"><Ellipsis :size="17" aria-hidden="true" /></button></div>
          <div v-for="row in treeRows" :key="row.folder.id" class="tree-row" :class="{ active: selectedId === row.folder.id && !showTrash }"><button class="tree-button" :class="{ active: selectedId === row.folder.id && !showTrash }" :style="{ paddingLeft: `${14 + row.depth * 18}px` }" type="button" :aria-current="selectedId === row.folder.id && !showTrash ? 'page' : undefined" :aria-expanded="folders.some(folder => folder.parent_id === row.folder.id) ? expandedFolderIds.has(row.folder.id) : undefined" @click="openSidebarFolder(row.folder.id)" @contextmenu.prevent="showFolderContextMenu(row.folder.id, $event.clientX, $event.clientY)" @keydown="handleFolderContextKey($event, row.folder.id)"><Folder :size="17" aria-hidden="true" /> <span class="truncate">{{ row.folder.name }}</span><ChevronRight v-if="folders.some(folder => folder.parent_id === row.folder.id)" :size="14" class="tree-chevron" :class="{ expanded: expandedFolderIds.has(row.folder.id) }" aria-hidden="true" /></button><button class="tree-menu-button" type="button" :aria-label="`Tùy chọn ${row.folder.name}`" :title="`Tùy chọn ${row.folder.name}`" @mouseenter="hoverFolderMenuFromButton(row.folder.id, $event)" @mouseleave="scheduleFolderMenuClose" @click="openFolderMenuFromButton(row.folder.id, $event)"><Ellipsis :size="17" aria-hidden="true" /></button></div>
        </nav>
        <button class="tree-button trash-nav" :class="{ active: showTrash }" type="button" aria-label="Mở thùng rác" :aria-current="showTrash ? 'page' : undefined" @click="openTrash"><Trash2 :size="17" aria-hidden="true" /> Thùng rác</button>
      </aside>

      <div v-if="folderContextMenu" ref="folderContextMenuElement" class="folder-context-menu" role="menu" :style="{ left: `${folderContextMenu.left}px`, top: `${folderContextMenu.top}px` }" @mouseenter="cancelFolderMenuClose" @mouseleave="scheduleFolderMenuClose">
        <p class="folder-context-title">{{ folderContextMenu.folderId ? folderById.get(folderContextMenu.folderId)?.name : 'Thư viện' }}</p>
        <button type="button" role="menuitem" @click="chooseFolderContextAction('create')"><FolderPlus :size="17" aria-hidden="true" /> {{ folderContextMenu.folderId ? 'Tạo thư mục con' : 'Tạo thư mục gốc' }}</button>
        <template v-if="folderContextMenu.folderId">
          <button type="button" role="menuitem" @click="chooseFolderContextAction('rename')"><Pencil :size="16" aria-hidden="true" /> Đổi tên</button>
          <button type="button" role="menuitem" @click="chooseFolderContextAction('move')"><MoveRight :size="17" aria-hidden="true" /> Chuyển thư mục</button>
          <div class="folder-submenu-anchor" @mouseenter="setAddChoices(true, $event)" @mouseleave="showAddChoices = false">
            <button type="button" role="menuitem" aria-haspopup="menu" :aria-expanded="showAddChoices" @focus="setAddChoices(true, $event)" @click="setAddChoices(true, $event)"><BookOpen :size="17" aria-hidden="true" /> Thêm <Ellipsis class="folder-submenu-indicator" :size="17" aria-hidden="true" /></button>
            <div v-if="showAddChoices" class="folder-submenu" :class="{ 'opens-left': addSubmenuLeft, 'opens-above': addSubmenuAbove }" role="menu" aria-label="Thêm mục học tập"><button type="button" role="menuitem" @click="startNewItem('word')">Từ / cụm từ</button><button type="button" role="menuitem" @click="startNewItem('sentence')">Câu</button><button type="button" role="menuitem" @click="startNewItem('grammar')">Ngữ pháp</button><button type="button" role="menuitem" @click="startNewItem('note')">Ghi chú</button></div>
          </div>
          <button type="button" role="menuitem" @click="requestTrashFolder"><Trash2 :size="17" aria-hidden="true" /> Xóa thư mục</button>
        </template>
      </div>

      <section v-if="showTrash" class="library-main trash-main" aria-labelledby="trash-title">
        <div class="library-header"><div><p class="overline">CÓ THỂ KHÔI PHỤC</p><h1 id="trash-title">Thùng rác</h1><p class="library-subtitle">Mục chỉ bị xóa vĩnh viễn khi bạn chọn.</p></div><button v-if="trash.length" type="button" class="danger-button" :disabled="trashBusy" @click="askToDelete('Xóa vĩnh viễn toàn bộ thùng rác? Thao tác này không thể hoàn tác.', () => learningApi.emptyTrash(), 'Đã xóa vĩnh viễn toàn bộ thùng rác.')">Dọn sạch thùng rác</button></div>
        <p v-if="feedback" class="trash-feedback" role="status">{{ feedback }}</p>
        <p v-if="!trash.length" class="saved-items-empty">Thùng rác trống.</p>
        <div v-else class="trash-grid">
          <article v-for="entry in trash" :key="entry.id" class="trash-card">
            <span class="saved-item-category">{{ entry.kind === 'folder' ? 'Thư mục' : entry.category === 'word' ? 'Từ / cụm từ' : entry.category === 'sentence' ? 'Câu' : entry.category === 'grammar' ? 'Ngữ pháp' : 'Ghi chú' }}</span>
            <h2>{{ entry.name }}</h2>
            <p>{{ entry.kind === 'folder' ? 'Gồm thư mục con và mục học tập bên trong.' : 'Mục học tập đã xóa.' }}</p>
            <div class="trash-actions"><button type="button" :aria-label="`Khôi phục ${entry.name}`" :disabled="trashBusy" @click="restoreEntry(entry)"><RotateCcw :size="16" aria-hidden="true" /> Khôi phục</button><button type="button" class="danger-button" :aria-label="`Xóa vĩnh viễn ${entry.name}`" :disabled="trashBusy" @click="askToDelete(`Xóa vĩnh viễn “${entry.name}”? Thao tác này không thể hoàn tác.`, () => entry.kind === 'folder' ? learningApi.permanentlyDeleteFolder(entry.id) : learningApi.permanentlyDeleteItem(entry.id), `Đã xóa vĩnh viễn “${entry.name}”.`)"><Trash2 :size="16" aria-hidden="true" /> Xóa vĩnh viễn</button></div>
          </article>
        </div>
      </section>
      <section v-else class="library-main" aria-label="Thư viện học tập">
        <p v-if="feedback" class="trash-feedback" role="status">{{ feedback }}</p>
        <div v-if="linkRequest" class="link-banner" role="status">
          <div class="link-banner-icon"><Link2 :size="20" aria-hidden="true" /></div>
          <div><strong>Liên kết extension với tài khoản này?</strong><p>{{ linkApproved ? linkMessage : 'Chỉ xác nhận nếu chính bạn đã bắt đầu liên kết từ cài đặt extension.' }}</p></div>
          <button v-if="!linkApproved" class="link-button" type="button" :disabled="linkBusy" @click="approveLink">{{ linkBusy ? 'Đang liên kết…' : 'Xác nhận liên kết' }}</button>
          <Check v-else :size="20" aria-hidden="true" />
        </div>
        <nav class="breadcrumb" aria-label="Đường dẫn thư mục">
          <div class="breadcrumb-trail"><button type="button" :aria-current="selectedId === null ? 'page' : undefined" @click="openLibrary(null)">Thư viện</button><template v-for="(crumb, index) in breadcrumbs" :key="crumb.id"><ChevronRight :size="15" aria-hidden="true" /><button type="button" :aria-current="index === breadcrumbs.length - 1 ? 'page' : undefined" @click="openLibrary(crumb.id)">{{ crumb.name }}</button></template><span class="breadcrumb-count" aria-label="Thống kê vị trí hiện tại">({{ currentStats.words }} từ · {{ currentStats.sentences }} câu)</span></div>
        </nav>

        <p v-if="folderError" class="form-error library-error" role="alert">{{ folderError }}</p>
        <div v-if="foldersLoading" class="content-state" role="status">Đang tải thư mục…</div>
        <section v-if="currentChildren.length" class="child-folders" aria-label="Thư mục con">
          <h2>{{ selectedId ? 'Thư mục con' : 'Thư mục gốc' }}</h2>
          <div class="child-folder-grid"><div v-for="folder in currentChildren" :key="folder.id" class="child-folder-card" @contextmenu.prevent="showFolderContextMenu(folder.id, $event.clientX, $event.clientY)"><button type="button" class="child-folder-open" :aria-label="`Mở thư mục ${folder.name}`" @click="openLibrary(folder.id)" @keydown="handleFolderContextKey($event, folder.id)"><Folder :size="20" aria-hidden="true" /><span>{{ folder.name }}</span><ChevronRight :size="16" aria-hidden="true" /></button><button type="button" class="child-folder-menu" :aria-label="`Tùy chọn ${folder.name} trong lưới`" @mouseenter="hoverFolderMenuFromButton(folder.id, $event)" @mouseleave="scheduleFolderMenuClose" @click="openFolderMenuFromButton(folder.id, $event)"><Ellipsis :size="17" aria-hidden="true" /></button></div></div>
        </section>
        <section class="saved-items" aria-labelledby="saved-items-title">
          <div class="saved-items-heading"><h2 id="saved-items-title">Mục học tập <small>({{ filteredItems.length }})</small></h2><div class="saved-items-filters"><label class="sort-control">Loại <select v-model="categoryFilter" aria-label="Lọc mục học tập"><option value="all">Tất cả</option><option value="word">Từ / cụm từ</option><option value="sentence">Câu</option><option value="grammar">Ngữ pháp</option><option value="note">Ghi chú</option></select></label><details ref="displayOptions" class="display-options"><summary>Hiển thị <ChevronRight :size="14" aria-hidden="true" /></summary><div class="display-options-panel" role="group" aria-label="Trường hiển thị trên thẻ"><label><input v-model="cardFields.vietnamese" type="checkbox" aria-label="Hiển thị tiếng Việt" /> Tiếng Việt</label><label><input v-model="cardFields.chinese" type="checkbox" aria-label="Hiển thị tiếng Trung" /> Tiếng Trung</label><label><input v-model="cardFields.pinyin" type="checkbox" aria-label="Hiển thị Pinyin" /> Pinyin</label></div></details><label class="sort-control">Sắp xếp <select v-model="sortOrder" aria-label="Sắp xếp mục học tập"><option value="newest">Mới thêm</option><option value="oldest">Cũ trước</option></select></label></div></div>
          <p v-if="visibleItems.length === 0" class="saved-items-empty">Chưa có mục học tập trong vị trí này. Chọn Thêm trong menu thư mục hoặc lưu chữ Trung từ Translation Tooltip.</p>
          <p v-else-if="filteredItems.length === 0" class="saved-items-empty">Không có mục thuộc loại này trong thư mục.</p>
          <div v-else class="saved-items-list">
            <article v-for="(item, index) in pagedItems" :id="`learning-item-${item.id}`" :key="item.id" class="saved-item-row" :class="{ focused: focusedItemId === item.id }" :aria-label="`Mục học tập số ${(currentPage - 1) * PAGE_SIZE + index + 1}`" tabindex="-1">
              <span class="saved-item-number">{{ (currentPage - 1) * PAGE_SIZE + index + 1 }}</span>
              <div class="saved-item-body"><div class="saved-item-title"><h3 v-if="cardFields.chinese || item.category === 'note'" :lang="item.category === 'note' ? undefined : 'zh'" :class="{ 'multiline-content': item.category === 'grammar' }">{{ item.text }}</h3><span class="saved-item-category">{{ item.category === 'word' ? 'Từ / cụm từ' : item.category === 'sentence' ? 'Câu' : item.category === 'grammar' ? 'Ngữ pháp' : 'Ghi chú' }}</span></div><p v-if="cardFields.pinyin && item.pinyin && (item.category === 'word' || item.category === 'sentence')" class="saved-item-pinyin">{{ item.pinyin }}</p><p v-if="cardFields.vietnamese || item.category === 'note'" class="saved-item-meaning" :class="{ 'note-body': item.category === 'note', 'multiline-content': item.category === 'grammar' }">{{ item.meaning }}</p></div>
              <div class="saved-item-meta"><time :datetime="new Date(item.created_at < 100_000_000_000 ? item.created_at * 1000 : item.created_at).toISOString()">{{ formatAddedAt(item.created_at) }}</time><div class="saved-item-controls"><button v-if="item.linked_item_ids.length" type="button" class="linked-open-button" :aria-label="`Xem ${item.linked_item_ids.length} ${linkedKind(item)} liên kết của ${item.text}`" :title="`Xem ${item.linked_item_ids.length} mục liên kết`" @click="openLinkedItems(item)"><Link2 :size="16" aria-hidden="true" /><span>{{ item.linked_item_ids.length }}</span></button><button type="button" :aria-label="`Sửa ${item.text}`" @click="openItemEditor(item)"><Pencil :size="16" aria-hidden="true" /></button><button type="button" :aria-label="`Xóa ${item.text}`" @click="askToDelete(`Chuyển “${item.text}” vào thùng rác?`, () => learningApi.trashItem(item.id), 'Đã chuyển mục học tập vào thùng rác.')"><Trash2 :size="16" aria-hidden="true" /></button></div></div>
            </article>
          </div>
          <nav v-if="filteredItems.length" class="pagination" aria-label="Phân trang mục học tập"><button type="button" aria-label="Trang trước" :disabled="currentPage === 1" @click="page = currentPage - 1">Trước</button><span>Trang {{ currentPage }} / {{ pageCount }}</span><button type="button" aria-label="Trang sau" :disabled="currentPage === pageCount" @click="page = currentPage + 1">Sau</button></nav>
        </section>
      </section>
    </main>

    <dialog ref="editor" class="editor-dialog" @click.self="closeEditor">
      <form @submit.prevent="submitEditor">
        <div class="dialog-icon"><Folder :size="23" aria-hidden="true" /></div>
        <h2>{{ editorMode === 'create' ? 'Tạo thư mục mới' : editorMode === 'rename' ? 'Đổi tên thư mục' : 'Chuyển thư mục' }}</h2>
        <p>{{ editorMode === 'create' ? 'Đặt tên theo bài học hoặc chủ đề của bạn.' : editorMode === 'rename' ? 'Tên mới sẽ hiện ở mọi nơi trong thư viện.' : 'Chọn vị trí mới cho thư mục này.' }}</p>
        <template v-if="editorMode !== 'move'"><label for="folder-name">Tên thư mục</label><input id="folder-name" ref="editorInput" v-model="editorName" maxlength="100" required placeholder="Ví dụ: HSK 1" /></template>
        <template v-if="editorMode === 'move'"><label for="folder-parent">Chuyển vào</label><select id="folder-parent" v-model="editorParentId"><option :value="null">Thư viện (gốc)</option><option v-for="row in moveDestinations" :key="row.folder.id" :value="row.folder.id">{{ '— '.repeat(row.depth) + row.folder.name }}</option></select></template>
        <p v-if="editorError" class="form-error" role="alert">{{ editorError }}</p>
        <div class="dialog-actions"><button class="plain-button" type="button" @click="closeEditor">Hủy</button><button class="primary-button" type="submit" :disabled="editorBusy">{{ editorBusy ? 'Đang lưu…' : editorMode === 'create' ? 'Tạo thư mục' : 'Lưu thay đổi' }}</button></div>
      </form>
    </dialog>
    <dialog ref="itemEditor" class="editor-dialog item-editor" @click.self="itemEditor?.close()">
      <form @submit.prevent="saveItem"><h2>Sửa mục học tập</h2><p>Chỉnh nội dung hoặc thư mục.</p>
        <label for="item-text">{{ editCategory === 'note' ? 'Tiêu đề' : editCategory === 'grammar' ? 'Cấu trúc' : 'Chữ Trung' }}</label><textarea v-if="editCategory === 'grammar'" id="item-text" v-model="editText" required lang="zh" rows="4"></textarea><input v-else id="item-text" v-model="editText" required :lang="editCategory === 'note' ? undefined : 'zh'" />
        <label for="item-meaning">{{ editCategory === 'note' ? 'Nội dung' : editCategory === 'grammar' ? 'Mô tả' : 'Nghĩa' }}</label><textarea v-if="editCategory === 'note' || editCategory === 'grammar'" id="item-meaning" v-model="editMeaning" required rows="5"></textarea><input v-else id="item-meaning" v-model="editMeaning" required />
        <label for="item-category">Loại</label><select id="item-category" v-model="editCategory" :disabled="!!editingItem?.linked_item_ids.length || editingItem?.category === 'note'"><option value="word">Từ / cụm từ</option><option value="sentence">Câu</option><option value="grammar">Ngữ pháp</option><option v-if="editingItem?.category === 'note'" value="note">Ghi chú</option></select>
        <label for="item-folder">Thư mục</label><select id="item-folder" v-model="editFolderId"><option v-for="folder in folders" :key="folder.id" :value="folder.id">{{ folder.name }}</option></select>
        <template v-if="editingItem?.category !== 'note'"><label for="item-link-target">Liên kết</label><div v-for="entry in editLinkedItems" :key="entry.id" class="linked-entry"><span>{{ entry.text }} · {{ folderById.get(entry.folder_id)?.name }}</span><button type="button" :aria-label="`Gỡ liên kết ${entry.text}`" @click="changeItemLink(entry.id, true)">Gỡ</button></div><div class="link-picker"><select id="item-link-target" v-model="editLinkTarget"><option value="">Chọn mục đã lưu</option><option v-for="entry in editLinkCandidates" :key="entry.id" :value="entry.id">{{ entry.text }} · {{ folderById.get(entry.folder_id)?.name }}</option></select><button type="button" aria-label="Thêm liên kết" :disabled="!editLinkTarget" @click="changeItemLink(editLinkTarget)">Thêm</button></div></template>
        <div v-if="editingItem?.category === 'word' || editingItem?.category === 'grammar'" class="example-editor"><h3>Câu ví dụ mới</h3><div v-for="(draft, index) in editExampleDrafts" :key="index" class="linked-entry"><span>{{ exampleLabel(draft) }}</span><button type="button" @click="editExampleDrafts.splice(index, 1)">Bỏ</button></div><label for="edit-example-text">Câu mới</label><textarea id="edit-example-text" v-model="editExampleText" rows="2"></textarea><label for="edit-example-meaning">Nghĩa câu mới</label><input id="edit-example-meaning" v-model="editExampleMeaning" /><button type="button" aria-label="Thêm câu ví dụ vào bản nháp" :disabled="!editExampleText.trim() || !editExampleMeaning.trim()" @click="addEditExample">Thêm câu mới</button><label for="edit-example-existing">Câu đã lưu</label><select id="edit-example-existing" v-model="editExampleExisting"><option value="">Chọn câu</option><option v-for="entry in editExampleCandidates" :key="entry.id" :value="entry.id">{{ entry.text }} · {{ folderById.get(entry.folder_id)?.name }}</option></select><button type="button" aria-label="Thêm câu đã lưu vào bản nháp" :disabled="!editExampleExisting" @click="addEditExistingExample">Thêm câu đã lưu</button></div>
        <p v-if="itemError" class="form-error" role="alert">{{ itemError }}</p>
        <div class="dialog-actions"><button type="button" class="plain-button" @click="itemEditor?.close()">Hủy</button><button type="submit" class="primary-button" :disabled="itemBusy">{{ itemBusy ? 'Đang lưu…' : 'Lưu thay đổi' }}</button></div>
      </form>
    </dialog>
    <dialog ref="newItemEditor" class="editor-dialog new-item-editor" @click.self="newItemEditor?.close()">
      <form @submit.prevent="submitNewItem"><h2>{{ newItemCategory === 'word' ? 'Thêm từ / cụm từ' : newItemCategory === 'sentence' ? 'Thêm câu' : newItemCategory === 'grammar' ? 'Thêm ngữ pháp' : 'Thêm ghi chú' }}</h2><p>Thêm vào thư mục “{{ folderById.get(newItemFolderId)?.name }}”.</p>
        <label for="new-item-text">{{ newItemCategory === 'word' ? 'Từ / cụm từ' : newItemCategory === 'sentence' ? 'Câu' : newItemCategory === 'grammar' ? 'Cấu trúc' : 'Tiêu đề' }}</label><textarea v-if="newItemCategory === 'sentence' || newItemCategory === 'grammar'" id="new-item-text" v-model="newItemText" required lang="zh" rows="4"></textarea><input v-else id="new-item-text" v-model="newItemText" required :lang="newItemCategory === 'note' ? undefined : 'zh'" @change="requestMeaningSuggestion" />
        <label for="new-item-meaning">{{ newItemCategory === 'word' ? 'Nghĩa gợi ý' : newItemCategory === 'grammar' ? 'Mô tả' : newItemCategory === 'note' ? 'Nội dung' : 'Nghĩa' }}</label><textarea v-if="newItemCategory === 'note' || newItemCategory === 'grammar'" id="new-item-meaning" v-model="newItemMeaning" required rows="5"></textarea><input v-else id="new-item-meaning" v-model="newItemMeaning" required @input="newItemMeaningUserEdited = true" />
        <p v-if="newItemCategory === 'word' && newItemSuggestionBusy" class="form-hint" role="status">Đang gợi ý nghĩa…</p>
        <p v-if="newItemSuggestionError" class="form-hint" role="status">{{ newItemSuggestionError }}</p>
        <div v-if="newItemCategory === 'word' || newItemCategory === 'grammar'" class="example-editor"><h3>Câu ví dụ</h3><div v-for="(draft, index) in exampleDrafts" :key="index" class="linked-entry"><span>{{ exampleLabel(draft) }}</span><button type="button" :aria-label="`Bỏ câu ví dụ ${exampleLabel(draft)}`" @click="exampleDrafts.splice(index, 1)">Bỏ</button></div><label for="example-text">Câu mới</label><textarea id="example-text" v-model="exampleText" rows="2"></textarea><label for="example-meaning">Nghĩa câu mới</label><input id="example-meaning" v-model="exampleMeaning" /><button type="button" aria-label="Thêm câu mới" :disabled="!exampleText.trim() || !exampleMeaning.trim()" @click="addNewExample">Thêm câu mới</button><label for="example-existing">Câu đã lưu</label><select id="example-existing" v-model="exampleExisting"><option value="">Chọn câu</option><option v-for="entry in exampleCandidates" :key="entry.id" :value="entry.id">{{ entry.text }} · {{ folderById.get(entry.folder_id)?.name }}</option></select><button type="button" aria-label="Chọn câu đã lưu" :disabled="!exampleExisting" @click="addExistingExample">Chọn câu đã lưu</button></div>
        <p v-if="newItemError" class="form-error" role="alert">{{ newItemError }}</p>
        <div class="dialog-actions"><button type="button" class="plain-button" @click="newItemEditor?.close()">Hủy</button><button type="submit" class="primary-button" :disabled="newItemBusy">{{ newItemBusy ? 'Đang lưu…' : 'Lưu' }}</button></div>
      </form>
    </dialog>
    <dialog ref="linkedItemsDialog" class="editor-dialog linked-items-dialog" aria-labelledby="linked-items-title" @click.self="closeLinkedItems" @close="linkedSourceId = null">
      <div class="linked-dialog-header"><div><h2 id="linked-items-title">{{ linkedSource?.category === 'sentence' ? (linkedSource.linked_item_ids.some(id => itemById.get(id)?.category === 'grammar') ? 'Mục liên kết' : 'Từ liên kết') : 'Câu liên kết' }}</h2><p>Liên kết với “{{ linkedSource?.text }}”</p></div><button type="button" class="plain-button" aria-label="Đóng mục liên kết" @click="closeLinkedItems">Đóng</button></div>
      <div class="linked-items-list"><article v-for="entry in linkedEntries" :key="entry.id" class="linked-entry"><h3 lang="zh">{{ entry.text }}</h3><p class="linked-entry-pinyin">{{ entry.pinyin }}</p><p class="linked-entry-meaning">{{ entry.meaning }}</p><span class="linked-entry-folder">{{ folderById.get(entry.folder_id)?.name ?? 'Thư viện' }}</span><div class="linked-entry-actions"><button type="button" :aria-label="`Mở ${entry.text}`" @click="followLinkedItem(entry.id)"><ArrowRight :size="16" aria-hidden="true" /> Mở</button><button type="button" :aria-label="`Sửa ${entry.text} trong liên kết`" @click="editLinkedItem(entry)"><Pencil :size="16" aria-hidden="true" /> Sửa</button></div></article></div>
      <p v-if="!linkedEntries.length" class="saved-items-empty">Không còn mục liên kết nào.</p>
    </dialog>
    <dialog ref="confirmDialog" class="editor-dialog confirm-dialog" @click.self="confirmDialog?.close()">
      <form @submit.prevent="confirmDeletion"><div class="dialog-icon danger-icon"><Trash2 :size="23" aria-hidden="true" /></div><h2>Xác nhận xóa</h2><p>{{ confirmLabel }}</p><p v-if="feedback" class="form-error" role="alert">{{ feedback }}</p><div class="dialog-actions"><button type="button" class="plain-button" @click="confirmDialog?.close()">Hủy</button><button type="submit" class="danger-button" :disabled="trashBusy">{{ trashBusy ? 'Đang xử lý…' : 'Xác nhận' }}</button></div></form>
    </dialog>
  </div>
</template>
