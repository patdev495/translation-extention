<script setup lang="ts">
import { Share2 } from '@lucide/vue';
import { computed, onMounted, ref } from 'vue';
import { ApiError, learningApi, type LearningFolder } from './api';

const props = defineProps<{ folder: LearningFolder }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const linkField = ref<HTMLInputElement | null>(null);
const token = ref<string | null>(null);
const loaded = ref(false);
const busy = ref(false);
const error = ref('');
const feedback = ref('');
const shareUrl = computed(() => token.value ? `${window.location.origin}/#share=${token.value}` : '');

async function updateLink(operation: 'load' | 'enable' | 'disable'): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  feedback.value = '';
  try {
    if (operation === 'load') {
      token.value = (await learningApi.folderShareLink(props.folder.id)).token;
    } else if (operation === 'enable') {
      token.value = (await learningApi.enableFolderShareLink(props.folder.id)).token;
    } else {
      await learningApi.disableFolderShareLink(props.folder.id);
      token.value = null;
      feedback.value = 'Đã tắt liên kết.';
    }
    loaded.value = true;
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.status === 404
      ? 'Không tìm thấy thư mục.'
      : 'Không cập nhật được liên kết. Hãy thử lại.';
  } finally {
    busy.value = false;
  }
}

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    feedback.value = 'Đã sao chép liên kết.';
  } catch {
    linkField.value?.focus();
    linkField.value?.select();
    feedback.value = 'Hãy sao chép liên kết đã chọn.';
  }
}

onMounted(() => {
  dialog.value?.showModal();
  void updateLink('load');
});
</script>

<template>
  <dialog ref="dialog" class="editor-dialog" aria-labelledby="share-folder-title" @close="emit('close')" @click.self="dialog?.close()">
    <div class="dialog-icon"><Share2 :size="23" aria-hidden="true" /></div>
    <h2 id="share-folder-title">Chia sẻ “{{ folder.name }}”</h2>
    <p class="library-subtitle">Ai có liên kết đều có thể xem thư mục này, các thư mục con và mục học tập bên trong mà không cần đăng nhập.</p>
    <template v-if="loaded">
      <template v-if="token">
        <label for="folder-share-url">Liên kết chỉ xem</label>
        <div class="share-link-field">
          <input id="folder-share-url" ref="linkField" :value="shareUrl" readonly @focus="linkField?.select()" />
          <button type="button" class="primary-button" :disabled="busy" @click="copyLink">Sao chép</button>
        </div>
      </template>
      <p v-else class="form-hint">Liên kết hiện đang tắt.</p>
    </template>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="feedback" class="form-hint" role="status">{{ feedback }}</p>
    <p v-if="busy && !loaded" class="form-hint" role="status">Đang tải liên kết…</p>
    <div class="dialog-actions">
      <button v-if="loaded && token" type="button" class="danger-button" :disabled="busy" @click="updateLink('disable')">Tắt liên kết</button>
      <button v-else-if="loaded" type="button" class="primary-button" :disabled="busy" @click="updateLink('enable')">Bật liên kết</button>
      <button v-else-if="error" type="button" class="secondary-button" :disabled="busy" @click="updateLink('load')">Thử lại</button>
      <button type="button" class="plain-button" @click="dialog?.close()">Đóng</button>
    </div>
  </dialog>
</template>

<style scoped>
.share-link-field { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.share-link-field input { flex: 1; min-width: 140px; }
</style>
