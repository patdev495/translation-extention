<script setup lang="ts">
import { Share2 } from '@lucide/vue';
import { onMounted, ref } from 'vue';
import { ApiError, learningApi, type Account, type LearningFolder } from './api';

const props = defineProps<{ folder: LearningFolder }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const username = ref('');
const viewers = ref<Account[]>([]);
const loaded = ref(false);
const busy = ref(false);
const error = ref('');
const feedback = ref('');

function message(cause: unknown): string {
  if (!(cause instanceof ApiError)) return 'Đã có lỗi xảy ra. Hãy thử lại.';
  switch (cause.message) {
    case 'Viewer account not found': return 'Không tìm thấy tài khoản có tên đăng nhập này.';
    case 'Folder owner already has access': return 'Bạn đã có quyền truy cập vì là chủ thư mục.';
    case 'Learning Folder not found': return 'Không tìm thấy thư mục.';
    default: return cause.message;
  }
}

async function loadViewers(): Promise<void> {
  busy.value = true;
  error.value = '';
  try {
    viewers.value = await learningApi.folderViewers(props.folder.id);
    loaded.value = true;
  } catch (cause) {
    error.value = message(cause);
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  dialog.value?.showModal();
  void loadViewers();
});

async function grant(): Promise<void> {
  if (!username.value.trim() || busy.value) return;
  busy.value = true;
  error.value = '';
  feedback.value = '';
  try {
    const viewer = await learningApi.grantFolderViewer(props.folder.id, username.value.trim());
    if (!viewers.value.some(entry => entry.id === viewer.id)) {
      viewers.value = [...viewers.value, viewer].sort((a, b) => a.username.localeCompare(b.username));
    }
    username.value = '';
    feedback.value = `${viewer.username} có quyền xem.`;
  } catch (cause) {
    error.value = message(cause);
  } finally {
    busy.value = false;
  }
}

async function revoke(viewer: Account): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  feedback.value = '';
  try {
    await learningApi.revokeFolderViewer(props.folder.id, viewer.id);
    viewers.value = viewers.value.filter(entry => entry.id !== viewer.id);
    feedback.value = `Đã thu hồi quyền xem của ${viewer.username} đối với lượt chia sẻ này.`;
  } catch (cause) {
    error.value = message(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <dialog ref="dialog" class="editor-dialog" aria-labelledby="share-folder-title" @close="emit('close')" @click.self="dialog?.close()">
    <div class="dialog-icon"><Share2 :size="23" aria-hidden="true" /></div>
    <h2 id="share-folder-title">Chia sẻ “{{ folder.name }}”</h2>
    <p class="library-subtitle">Người được cấp quyền có thể xem thư mục này, các thư mục con và mục học tập bên trong.</p>
    <form v-if="loaded" @submit.prevent="grant">
      <label for="folder-viewer-username">Tên đăng nhập người nhận</label>
      <div class="share-recipient">
        <input id="folder-viewer-username" v-model="username" required :disabled="busy" />
        <button type="submit" class="primary-button" :disabled="busy || !username.trim()">Cấp quyền xem</button>
      </div>
    </form>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="feedback" class="form-hint" role="status">{{ feedback }}</p>
    <p v-if="busy && !loaded" class="form-hint" role="status">Đang tải quyền xem…</p>
    <template v-if="loaded">
      <h3 class="share-viewers-title">Người có quyền xem trực tiếp</h3>
      <ul v-if="viewers.length" class="share-viewers">
        <li v-for="viewer in viewers" :key="viewer.id" class="linked-entry">
          <span>{{ viewer.username }}</span>
          <button type="button" class="danger-button" :aria-label="`Thu hồi quyền xem của ${viewer.username}`" :disabled="busy" @click="revoke(viewer)">Thu hồi</button>
        </li>
      </ul>
      <p v-else class="form-hint">Chưa cấp quyền xem trực tiếp cho ai.</p>
    </template>
    <div class="dialog-actions">
      <button v-if="error && !loaded" type="button" class="secondary-button" :disabled="busy" @click="loadViewers">Thử lại</button>
      <button type="button" class="plain-button" @click="dialog?.close()">Đóng</button>
    </div>
  </dialog>
</template>

<style scoped>
.share-recipient { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.share-recipient input { flex: 1; min-width: 140px; }
.share-viewers-title { margin: 18px 0 8px; font-size: 14px; }
.share-viewers { display: grid; gap: 6px; padding: 0; list-style: none; }
.share-viewers li { display: flex; align-items: center; justify-content: space-between; gap: 8px; overflow-wrap: anywhere; }
.share-viewers button { flex-shrink: 0; }
</style>
