<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, Folder, FolderPlus, Home, Link2, LogOut, MoveRight, Pencil, Plus, Sparkles } from '@lucide/vue';
import { ApiError, learningApi, type Account, type LearningFolder, type SavedLearningItem } from './api';

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
const itemError = ref('');
const itemEditor = ref<HTMLDialogElement | null>(null);
const editingItem = ref<SavedLearningItem | null>(null);
const editText = ref('');
const editMeaning = ref('');
const editCategory = ref<'word' | 'sentence'>('word');
const editFolderId = ref('');
const itemBusy = ref(false);
const focusedItemId = ref<string | null>(null);
const selectedId = ref<string | null>(null);
const folderContextMenu = ref<FolderContextMenu | null>(null);
const folderContextMenuElement = ref<HTMLElement | null>(null);
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
  folderContextMenu.value = null;
}

function dismissFolderContextMenu(event: PointerEvent): void {
  if (folderContextMenuElement.value && !folderContextMenuElement.value.contains(event.target as Node)) {
    closeFolderContextMenu();
  }
}

function handleContextMenuEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeFolderContextMenu();
}

onMounted(() => {
  document.addEventListener('pointerdown', dismissFolderContextMenu);
  document.addEventListener('keydown', handleContextMenuEscape);
  window.addEventListener('resize', closeFolderContextMenu);
  window.addEventListener('scroll', closeFolderContextMenu, true);
});

onUnmounted(() => {
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

async function openItemEditor(item: SavedLearningItem): Promise<void> {
  editingItem.value = item;
  editText.value = item.text;
  editMeaning.value = item.meaning;
  editCategory.value = item.category;
  editFolderId.value = item.folder_id;
  itemError.value = '';
  itemEditor.value?.showModal();
  await nextTick();
  itemEditor.value?.querySelector('input')?.focus();
}

async function saveItem(): Promise<void> {
  if (!editingItem.value) return;
  itemBusy.value = true;
  itemError.value = '';
  try {
    await learningApi.updateItem(editingItem.value.id, {
      text: editText.value.trim(), meaning: editMeaning.value.trim(), category: editCategory.value, folder_id: editFolderId.value,
    });
    items.value = await learningApi.items();
    itemEditor.value?.close();
  } catch (error) {
    itemError.value = errorMessage(error);
  } finally { itemBusy.value = false; }
}

function followItem(id: string): void {
  const target = itemById.value.get(id);
  if (!target) return;
  selectedId.value = target.folder_id;
  focusedItemId.value = id;
  void nextTick(() => document.getElementById(`learning-item-${id}`)?.focus());
}
const currentChildren = computed(() => folders.value
  .filter((folder) => folder.parent_id === selectedId.value)
  .sort((a, b) => a.name.localeCompare(b.name, 'vi')));

const treeRows = computed<TreeRow[]>(() => {
  const result: TreeRow[] = [];
  const visit = (parentId: string | null, depth: number): void => {
    folders.value
      .filter((folder) => folder.parent_id === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .forEach((folder) => {
        result.push({ folder, depth });
        visit(folder.id, depth + 1);
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

async function showFolderContextMenu(folderId: string | null, x: number, y: number): Promise<void> {
  folderContextMenu.value = { folderId, left: x, top: y };
  await nextTick();
  const menu = folderContextMenuElement.value;
  if (!menu) return;
  const rect = menu.getBoundingClientRect();
  folderContextMenu.value = {
    folderId,
    left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
    top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
  };
  menu.querySelector('button')?.focus();
}

function handleFolderContextKey(event: KeyboardEvent, folderId: string | null): void {
  if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
  event.preventDefault();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  void showFolderContextMenu(folderId, rect.left + 18, rect.bottom);
}

function chooseFolderContextAction(mode: EditorMode): void {
  const folderId = folderContextMenu.value?.folderId ?? null;
  closeFolderContextMenu();
  void openEditor(mode, folderId);
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
    if (editorMode.value === 'create') {
      const folder = await learningApi.createFolder(editorName.value.trim(), editorParentId.value);
      selectedId.value = folder.id;
    } else if (editorMode.value === 'rename') {
      await learningApi.updateFolder(editorTarget.value!, { name: editorName.value.trim() });
    } else {
      await learningApi.updateFolder(editorTarget.value!, { parent_id: editorParentId.value });
    }
    await loadFolders();
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
      <span class="topbar-tag">Không gian học tiếng Trung của bạn</span>
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
          <input id="username" v-model="username" type="text" autocomplete="username" :pattern="accountMode === 'register' ? '[A-Za-z0-9_.-]+' : '[A-Za-z0-9_.@-]+'" required placeholder="Ví dụ: hocvien_hsk1" />
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
        <div class="sidebar-heading"><span>THƯ VIỆN</span><button class="small-icon-button" type="button" title="Tạo thư mục gốc" aria-label="Tạo thư mục gốc" @click="openEditor('create')"><FolderPlus :size="18" /></button></div>
        <nav aria-label="Cây thư mục">
          <button class="tree-button" :class="{ active: selectedId === null }" type="button" :aria-current="selectedId === null ? 'page' : undefined" @click="selectedId = null" @contextmenu.prevent="showFolderContextMenu(null, $event.clientX, $event.clientY)" @keydown="handleFolderContextKey($event, null)"><Home :size="17" aria-hidden="true" /> Tất cả thư mục</button>
          <button v-for="row in treeRows" :key="row.folder.id" class="tree-button" :class="{ active: selectedId === row.folder.id }" :style="{ paddingLeft: `${14 + row.depth * 18}px` }" type="button" :aria-current="selectedId === row.folder.id ? 'page' : undefined" @click="selectedId = row.folder.id" @contextmenu.prevent="showFolderContextMenu(row.folder.id, $event.clientX, $event.clientY)" @keydown="handleFolderContextKey($event, row.folder.id)"><Folder :size="17" aria-hidden="true" /> <span class="truncate">{{ row.folder.name }}</span></button>
        </nav>
        <div class="sidebar-note"><CircleHelp :size="18" aria-hidden="true" /><p>Chuột phải vào thư mục để quản lý nhanh. Tạo thư mục tại đây, rồi chọn khi lưu từ extension.</p></div>
      </aside>

      <div v-if="folderContextMenu" ref="folderContextMenuElement" class="folder-context-menu" role="menu" :style="{ left: `${folderContextMenu.left}px`, top: `${folderContextMenu.top}px` }">
        <p class="folder-context-title">{{ folderContextMenu.folderId ? folderById.get(folderContextMenu.folderId)?.name : 'Thư viện' }}</p>
        <button type="button" role="menuitem" @click="chooseFolderContextAction('create')"><FolderPlus :size="17" aria-hidden="true" /> {{ folderContextMenu.folderId ? 'Tạo thư mục con' : 'Tạo thư mục gốc' }}</button>
        <template v-if="folderContextMenu.folderId">
          <button type="button" role="menuitem" @click="chooseFolderContextAction('rename')"><Pencil :size="16" aria-hidden="true" /> Đổi tên</button>
          <button type="button" role="menuitem" @click="chooseFolderContextAction('move')"><MoveRight :size="17" aria-hidden="true" /> Chuyển thư mục</button>
        </template>
      </div>

      <section class="library-main" aria-labelledby="library-title">
        <div v-if="linkRequest" class="link-banner" role="status">
          <div class="link-banner-icon"><Link2 :size="20" aria-hidden="true" /></div>
          <div><strong>Liên kết extension với tài khoản này?</strong><p>{{ linkApproved ? linkMessage : 'Chỉ xác nhận nếu chính bạn đã bắt đầu liên kết từ cài đặt extension.' }}</p></div>
          <button v-if="!linkApproved" class="link-button" type="button" :disabled="linkBusy" @click="approveLink">{{ linkBusy ? 'Đang liên kết…' : 'Xác nhận liên kết' }}</button>
          <Check v-else :size="20" aria-hidden="true" />
        </div>
        <nav class="breadcrumb" aria-label="Đường dẫn thư mục"><span class="breadcrumb-label">VỊ TRÍ</span><button type="button" :aria-current="selectedId === null ? 'page' : undefined" @click="selectedId = null">Thư viện</button><template v-for="(crumb, index) in breadcrumbs" :key="crumb.id"><ChevronRight :size="17" aria-hidden="true" /><button type="button" :aria-current="index === breadcrumbs.length - 1 ? 'page' : undefined" @click="selectedId = crumb.id">{{ crumb.name }}</button></template></nav>
        <div class="library-header">
          <div><p class="overline">KHÔNG GIAN CỦA BẠN</p><h1 id="library-title">{{ selectedFolder?.name ?? 'Thư viện học tập' }}</h1><p class="library-subtitle">{{ selectedFolder ? 'Sắp xếp bài học bên trong thư mục này.' : 'Tạo thư mục đầu tiên để bắt đầu lưu từ extension.' }}</p></div>
          <button class="primary-button create-button" type="button" @click="openEditor('create', selectedId)"><Plus :size="18" aria-hidden="true" /> Thư mục mới</button>
        </div>

        <div class="summary-strip"><span class="summary-icon"><Folder :size="22" aria-hidden="true" /></span><div><strong>{{ folders.length }}</strong><span>thư mục trong thư viện</span></div><span class="summary-divider"></span><div><strong>{{ currentChildren.length }}</strong><span>thư mục tại đây</span></div></div>

        <p v-if="folderError" class="form-error library-error" role="alert">{{ folderError }}</p>
        <div v-if="foldersLoading" class="content-state" role="status">Đang tải thư mục…</div>
        <div v-else-if="currentChildren.length === 0" class="empty-state"><div class="empty-illustration"><FolderPlus :size="38" :stroke-width="1.6" aria-hidden="true" /></div><h2>{{ selectedFolder ? 'Thư mục này còn trống' : 'Mỗi hành trình bắt đầu từ một thư mục' }}</h2><p>Ví dụ: tạo “HSK 1”, rồi thêm “Bài 01” bên trong. Bạn có thể đổi tên hoặc chuyển thư mục về sau.</p><button class="secondary-button" type="button" @click="openEditor('create', selectedId)"><Plus :size="17" aria-hidden="true" /> Tạo thư mục</button></div>
        <div v-else class="folder-grid">
          <article v-for="folder in currentChildren" :key="folder.id" class="folder-card">
            <button class="folder-card-main" type="button" :aria-label="`Mở thư mục ${folder.name}`" @click="selectedId = folder.id"><span class="folder-card-icon"><Folder :size="25" :stroke-width="1.8" aria-hidden="true" /></span><strong>{{ folder.name }}</strong><span class="folder-card-sub">{{ folders.filter((item) => item.parent_id === folder.id).length }} thư mục con</span><ChevronRight class="card-arrow" :size="19" aria-hidden="true" /></button>
            <div class="folder-card-actions"><button type="button" :aria-label="`Tạo thư mục con trong ${folder.name}`" title="Tạo thư mục con" @click="openEditor('create', folder.id)"><FolderPlus :size="17" /></button><button type="button" :aria-label="`Đổi tên ${folder.name}`" title="Đổi tên" @click="openEditor('rename', folder.id)"><Pencil :size="16" /></button><button type="button" :aria-label="`Chuyển ${folder.name}`" title="Chuyển thư mục" @click="openEditor('move', folder.id)"><MoveRight :size="17" /></button></div>
          </article>
        </div>
        <section class="saved-items" aria-labelledby="saved-items-title">
          <div class="saved-items-heading"><div><p class="overline">ĐÃ LƯU TỪ EXTENSION</p><h2 id="saved-items-title">Mục học tập</h2></div><span>{{ visibleItems.length }} mục</span></div>
          <p v-if="visibleItems.length === 0" class="saved-items-empty">Chưa có mục học tập trong vị trí này. Lưu chữ Trung từ Translation Tooltip.</p>
          <div v-else class="saved-items-grid">
            <article v-for="item in visibleItems" :id="`learning-item-${item.id}`" :key="item.id" class="saved-item-card" :class="{ focused: focusedItemId === item.id }" tabindex="-1">
              <div class="saved-item-top"><span class="saved-item-category">{{ item.category === 'word' ? 'Từ / cụm từ' : 'Câu' }}</span><button type="button" :aria-label="`Sửa ${item.text}`" @click="openItemEditor(item)"><Pencil :size="16" aria-hidden="true" /> Sửa</button></div>
              <h3 lang="zh">{{ item.text }}</h3><p class="saved-item-pinyin">{{ item.pinyin }}</p><p class="saved-item-meaning">{{ item.meaning }}</p>
              <div v-if="item.linked_item_ids.length" class="saved-item-links"><span>Liên kết</span><button v-for="linkedId in item.linked_item_ids" :key="linkedId" type="button" @click="followItem(linkedId)">{{ itemById.get(linkedId)?.text ?? 'Mục liên kết' }} <ArrowRight :size="14" aria-hidden="true" /></button></div>
            </article>
          </div>
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
      <form @submit.prevent="saveItem"><h2>Sửa mục học tập</h2><p>Chỉnh chữ, nghĩa, loại hoặc thư mục. Pinyin sẽ cập nhật theo chữ mới.</p>
        <label for="item-text">Chữ Trung</label><input id="item-text" v-model="editText" required lang="zh" />
        <label for="item-meaning">Nghĩa</label><input id="item-meaning" v-model="editMeaning" required />
        <label for="item-category">Loại</label><select id="item-category" v-model="editCategory"><option value="word">Từ / cụm từ</option><option value="sentence">Câu</option></select>
        <label for="item-folder">Thư mục</label><select id="item-folder" v-model="editFolderId"><option v-for="folder in folders" :key="folder.id" :value="folder.id">{{ folder.name }}</option></select>
        <p v-if="itemError" class="form-error" role="alert">{{ itemError }}</p>
        <div class="dialog-actions"><button type="button" class="plain-button" @click="itemEditor?.close()">Hủy</button><button type="submit" class="primary-button" :disabled="itemBusy">{{ itemBusy ? 'Đang lưu…' : 'Lưu thay đổi' }}</button></div>
      </form>
    </dialog>
  </div>
</template>
