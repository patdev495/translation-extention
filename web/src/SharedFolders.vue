<script setup lang="ts">
import { ChevronRight, Folder } from '@lucide/vue';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { ApiError, learningApi, type LearningFolder, type SavedLearningItem, type SharedFolder, type SharedFolderContents } from './api';
import PronunciationButton from './PronunciationButton.vue';
import { usePracticeAudio } from './use-practice-audio';

const shares = ref<SharedFolder[]>([]);
const openedShare = ref<SharedFolder | null>(null);
const contents = ref<SharedFolderContents | null>(null);
const currentId = ref('');
const busy = ref(false);
const error = ref('');
const { sampleError, samplePlaying, playSample, stopPlayback } = usePracticeAudio();
const playingId = ref('');

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

async function loadShares(): Promise<void> {
  busy.value = true;
  try {
    shares.value = await learningApi.sharedFolders();
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Không tải được danh sách thư mục.';
  } finally {
    busy.value = false;
  }
}

async function openShare(share: SharedFolder): Promise<void> {
  busy.value = true;
  error.value = '';
  try {
    contents.value = await learningApi.sharedFolderContents(share.id);
    openedShare.value = share;
    currentId.value = share.id;
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) {
      shares.value = shares.value.filter(entry => entry.id !== share.id);
      error.value = 'Bạn không còn quyền xem thư mục này hoặc thư mục đã bị xóa.';
    } else {
      error.value = cause instanceof ApiError ? cause.message : 'Không mở được thư mục.';
    }
  } finally {
    busy.value = false;
  }
}

function backToShares(): void {
  stopAudio();
  openedShare.value = null;
  contents.value = null;
  currentId.value = '';
  error.value = '';
  void loadShares();
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

onMounted(loadShares);
onUnmounted(stopAudio);
</script>

<template>
  <section class="library-main" aria-labelledby="shared-folders-title">
    <div class="library-header">
      <div>
        <h1 id="shared-folders-title">Được chia sẻ với tôi</h1>
        <p v-if="openedShare" class="library-subtitle">Do {{ openedShare.owner_username }} chia sẻ · Chỉ xem</p>
      </div>
    </div>
    <p v-if="error" class="form-error library-error" role="alert">{{ error }}</p>
    <p v-if="busy" class="content-state" role="status">Đang tải thư mục…</p>
    <template v-if="!openedShare">
      <div v-if="shares.length" class="child-folder-grid">
        <div v-for="share in shares" :key="share.id" class="child-folder-card">
          <button type="button" class="child-folder-open" :disabled="busy" @click="openShare(share)">
            <Folder :size="20" aria-hidden="true" /><span>{{ share.name }} <small class="share-owner">{{ share.owner_username }}</small></span><ChevronRight :size="16" aria-hidden="true" />
          </button>
        </div>
      </div>
      <p v-else-if="!busy && !error" class="saved-items-empty">Chưa có thư mục nào được chia sẻ với bạn.</p>
      <button v-if="error && !busy" type="button" class="secondary-button" @click="backToShares">Tải lại danh sách</button>
    </template>
    <template v-else>
      <nav class="breadcrumb" aria-label="Đường dẫn thư mục được chia sẻ">
        <div class="breadcrumb-trail">
          <button type="button" @click="backToShares">Tất cả thư mục được chia sẻ</button>
          <template v-for="crumb in breadcrumbs" :key="crumb.id">
            <ChevronRight :size="15" aria-hidden="true" />
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
  </section>
</template>

<style scoped>
.share-owner { display: block; color: var(--muted); font-weight: 500; }
.shared-item { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto; min-height: 0; }
.shared-item .saved-item-body { grid-column: 1; }
.shared-item-links { margin-top: 9px; color: var(--indigo); font-size: 12px; }
.shared-item-links summary { cursor: pointer; }
.shared-item-links ul { padding-left: 14px; }
.shared-item-links button { text-align: left; overflow-wrap: anywhere; }
</style>
