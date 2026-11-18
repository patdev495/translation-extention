<script setup lang="ts">
import { BookOpen, ChevronRight, Folder } from '@lucide/vue';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { ApiError, learningApi, type LearningFolder, type SavedLearningItem, type SharedFolderContents } from './api';
import PronunciationButton from './PronunciationButton.vue';
import { usePracticeAudio } from './use-practice-audio';

const props = defineProps<{ token: string }>();
const contents = ref<SharedFolderContents | null>(null);
const currentId = ref('');
const busy = ref(true);
const error = ref('');
const { sampleError, samplePlaying, playSample, stopPlayback } = usePracticeAudio();
const playingId = ref('');

const rootFolder = computed(() => contents.value?.folders.find(folder => folder.id === contents.value?.root_id));
const breadcrumbs = computed(() => {
  const folders = contents.value?.folders ?? [];
  const path: LearningFolder[] = [];
  let folder = folders.find(entry => entry.id === currentId.value);
  while (folder) {
    path.unshift(folder);
    const parentId = folder.parent_id;
    folder = folders.find(entry => entry.id === parentId);
  }
  return path;
});
const children = computed(() => contents.value?.folders.filter(folder => folder.parent_id === currentId.value) ?? []);
const items = computed(() => contents.value?.items.filter(item => item.folder_id === currentId.value) ?? []);
const itemById = computed(() => new Map(contents.value?.items.map(item => [item.id, item])));
const categoryLabels: Record<SavedLearningItem['category'], string> = {
  word: 'Từ / cụm từ', sentence: 'Câu', grammar: 'Ngữ pháp', note: 'Ghi chú',
};

function stopAudio(): void {
  stopPlayback();
  playingId.value = '';
  sampleError.value = '';
}

function play(item: SavedLearningItem): void {
  if (playingId.value === item.id && samplePlaying.value) {
    stopAudio();
    return;
  }
  playingId.value = item.id;
  playSample(item.text);
}

async function loadShare(): Promise<void> {
  busy.value = true;
  error.value = '';
  try {
    const share = await learningApi.sharedFolderContents(props.token);
    contents.value = share;
    currentId.value = share.root_id;
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.status === 404
      ? 'Liên kết không hợp lệ hoặc đã bị tắt.'
      : 'Không tải được thư mục. Hãy thử lại.';
  } finally {
    busy.value = false;
  }
}

function openFolder(id: string): void {
  stopAudio();
  currentId.value = id;
}

async function followLink(id: string): Promise<void> {
  const target = itemById.value.get(id);
  if (!target) return;
  openFolder(target.folder_id);
  await nextTick();
  document.getElementById(`shared-item-${id}`)?.focus();
}

onMounted(loadShare);
onUnmounted(stopAudio);
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="PolyTranslate Learning - trang chủ">
        <span class="brand-mark"><BookOpen :size="21" :stroke-width="2.2" aria-hidden="true" /></span>
        <span>poly<span class="brand-accent">learn</span></span>
      </a>
    </header>
    <main class="library-main shared-folder-page" aria-labelledby="shared-folder-title">
      <div class="library-header">
        <div>
          <h1 id="shared-folder-title">{{ rootFolder?.name ?? 'Thư mục được chia sẻ' }}</h1>
          <p v-if="rootFolder" class="library-subtitle">Chỉ xem</p>
        </div>
      </div>
      <p v-if="error" class="form-error library-error" role="alert">{{ error }}</p>
      <p v-if="busy" class="content-state" role="status">Đang tải thư mục…</p>
      <template v-if="contents">
        <nav class="breadcrumb" aria-label="Đường dẫn thư mục được chia sẻ">
          <div class="breadcrumb-trail">
            <template v-for="(crumb, index) in breadcrumbs" :key="crumb.id">
              <ChevronRight v-if="index" :size="15" aria-hidden="true" />
              <button type="button" :aria-current="currentId === crumb.id ? 'page' : undefined" @click="openFolder(crumb.id)">{{ crumb.name }}</button>
            </template>
          </div>
        </nav>
        <section v-if="children.length" class="child-folders" aria-label="Thư mục con">
          <h2>Thư mục con</h2>
          <div class="child-folder-grid">
            <div v-for="folder in children" :key="folder.id" class="child-folder-card">
              <button type="button" class="child-folder-open" @click="openFolder(folder.id)">
                <Folder :size="20" aria-hidden="true" /><span>{{ folder.name }}</span><ChevronRight :size="16" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
        <section class="saved-items" aria-labelledby="shared-items-title">
          <div class="saved-items-heading"><h2 id="shared-items-title">Mục học tập <small>({{ items.length }})</small></h2></div>
          <p v-if="!items.length" class="saved-items-empty">Chưa có mục học tập trong thư mục này.</p>
          <div v-else class="saved-items-list">
            <article v-for="item in items" :id="`shared-item-${item.id}`" :key="item.id" class="saved-item-row shared-item" tabindex="-1">
              <div class="saved-item-body">
                <div class="saved-item-title">
                  <PronunciationButton v-if="item.category === 'word' || item.category === 'sentence'" :text="item.text" :playing="playingId === item.id && samplePlaying" @play="play(item)" />
                  <h3 :lang="item.category === 'note' ? undefined : 'zh'" :class="{ 'multiline-content': item.category === 'grammar' }">{{ item.text }}</h3>
                  <span class="saved-item-category">{{ categoryLabels[item.category] }}</span>
                </div>
                <p v-if="item.pinyin" class="saved-item-pinyin">{{ item.pinyin }}</p>
                <p class="saved-item-meaning" :class="{ 'multiline-content': item.category === 'grammar' || item.category === 'note' }">{{ item.meaning }}</p>
                <p v-if="playingId === item.id && sampleError" class="library-audio-feedback" role="status">{{ sampleError }}</p>
                <details v-if="item.linked_item_ids.length" class="shared-item-links">
                  <summary>{{ item.linked_item_ids.length }} mục liên kết</summary>
                  <ul><li v-for="id in item.linked_item_ids" :key="id"><button type="button" class="plain-button" @click="followLink(id)">{{ itemById.get(id)?.text }}</button></li></ul>
                </details>
              </div>
            </article>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.shared-folder-page { width: 100%; max-width: 1100px; margin-inline: auto; }
.shared-item { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto; min-height: 0; }
.shared-item .saved-item-body { grid-column: 1; }
.shared-item-links { margin-top: 9px; color: var(--indigo); font-size: 12px; }
.shared-item-links summary { cursor: pointer; }
.shared-item-links ul { padding-left: 14px; }
.shared-item-links button { text-align: left; overflow-wrap: anywhere; }
</style>
