<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { learningApi, type LearningFolder, type RecallResult, type ReviewOverview, type ReviewSession } from './api';
import ReviewFolderNode from './ReviewFolderNode.vue';

const props = defineProps<{ folders: LearningFolder[] }>();
const emit = defineEmits<{ openItem: [id: string] }>();
const scope = ref<string | null>(null);
const scopePicker = ref<HTMLDetailsElement | null>(null);
const rootFolders = computed(() => props.folders.filter(folder => !folder.parent_id || !props.folders.some(parent => parent.id === folder.parent_id)));
const scopeName = computed(() => props.folders.find(folder => folder.id === scope.value)?.name ?? 'Toàn bộ thư viện');
function selectScope(id: string | null): void {
  scope.value = id;
  if (scopePicker.value) scopePicker.value.open = false;
}
const kind = ref<'vocabulary' | 'grammar'>('vocabulary');
const mode = ref<'meaning' | 'chinese' | 'pinyin'>('meaning');
const overview = ref<ReviewOverview>({ entries: [], totals: { remembered: 0, not_yet: 0 } });
const session = ref<ReviewSession | null>(null);
const position = ref(0);
const revealed = ref(false);
const pinyinVisible = ref(false);
const scratchpads = ref<Record<number, string>>({});
const results = ref<Record<string, RecallResult>>({});
const busy = ref(false);
const error = ref('');
const current = computed(() => session.value?.questions[position.value] ?? null);
const complete = computed(() => !!session.value && position.value >= session.value.questions.length);
const summary = computed(() => ({
  remembered: Object.values(results.value).filter(value => value === 'remembered').length,
  not_yet: Object.values(results.value).filter(value => value === 'not_yet').length,
}));

async function refresh(): Promise<void> {
  try { overview.value = await learningApi.reviewOverview(scope.value); error.value = ''; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không tải được thống kê.'; }
}
watch(scope, () => { session.value = null; void refresh(); });
watch(kind, () => { session.value = null; });
onMounted(() => { void refresh(); document.addEventListener('keydown', onKeydown); });
onUnmounted(() => document.removeEventListener('keydown', onKeydown));

async function start(): Promise<void> {
  busy.value = true;
  try {
    session.value = await learningApi.startReview(kind.value, scope.value);
    position.value = 0;
    scratchpads.value = {};
    results.value = {};
    revealed.value = false;
    pinyinVisible.value = false;
    error.value = '';
    await refresh();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không bắt đầu được buổi ôn.'; }
  finally { busy.value = false; }
}
async function record(itemId: string, result: RecallResult): Promise<void> {
  if (!session.value) return;
  await learningApi.recordRecall(session.value.id, itemId, result);
  results.value = { ...results.value, [itemId]: result };
  await refresh();
}
async function notYet(itemId: string): Promise<void> {
  await assess(itemId, 'not_yet');
}
async function assess(itemId: string, result: RecallResult): Promise<void> {
  busy.value = true;
  try {
    await record(itemId, result);
    if (kind.value === 'vocabulary') advance();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không lưu được kết quả.'; }
  finally { busy.value = false; }
}
function advance(): void {
  position.value += 1;
  revealed.value = false;
  pinyinVisible.value = false;
}
async function next(): Promise<void> {
  if (!current.value || busy.value) return;
  busy.value = true;
  try {
    if (kind.value === 'vocabulary' || revealed.value) {
      for (const id of current.value.item_ids) await record(id, kind.value === 'grammar' && results.value[id] === 'not_yet' ? 'not_yet' : 'remembered');
    }
    advance();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không lưu được kết quả.'; }
  finally { busy.value = false; }
}
function previous(): void {
  if (position.value <= 0) return;
  position.value -= 1;
  revealed.value = false;
  pinyinVisible.value = false;
}
function onKeydown(event: KeyboardEvent): void {
  if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || !session.value || !current.value) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest('input, textarea, select, .review-card, [contenteditable="true"]')) return;
  event.preventDefault();
  void next();
}
const front = computed(() => {
  const entry = current.value?.items[0];
  return mode.value === 'meaning' ? entry?.meaning : mode.value === 'chinese' ? entry?.text : entry?.pinyin;
});
</script>

<template>
  <section class="review-page" aria-label="Ôn tập">
    <header><h1>Ôn tập</h1><p>Ôn lại nội dung trong thư viện học tập.</p></header>
    <div class="review-controls">
      <div class="review-scope-control"><span>Phạm vi ôn tập</span><details ref="scopePicker" class="review-scope-picker"><summary aria-label="Phạm vi ôn tập">{{ scopeName }}</summary><div class="review-scope-menu"><button type="button" class="review-all-folders" :aria-current="scope === null ? 'true' : undefined" @click="selectScope(null)">Toàn bộ thư viện</button><ul class="review-scope-tree"><ReviewFolderNode v-for="folder in rootFolders" :key="folder.id" :folder="folder" :folders="folders" :selected="scope" @select="selectScope" /></ul></div></details></div>
      <label>Hoạt động <select v-model="kind" aria-label="Hoạt động ôn tập"><option value="vocabulary">Ôn từ vựng</option><option value="grammar">Ôn ngữ pháp</option></select></label>
      <label v-if="kind === 'vocabulary'">Mặt trước <select v-model="mode" aria-label="Mặt trước flashcard"><option value="meaning">Nghĩa tiếng Việt</option><option value="chinese">Chữ Trung</option><option value="pinyin">Pinyin</option></select></label>
      <button type="button" aria-label="Bắt đầu ôn tập" :disabled="busy" @click="start">{{ session ? 'Ôn lại' : 'Bắt đầu ôn tập' }}</button>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <div v-if="kind === 'grammar' && session?.ineligible_count" class="review-missing"><p>{{ session.ineligible_count }} mục Ngữ pháp chưa có Câu ví dụ.</p><button v-for="id in session.ineligible_item_ids" :key="id" type="button" @click="emit('openItem', id)">Thêm Câu ví dụ cho {{ overview.entries.find(entry => entry.id === id)?.text ?? 'Ngữ pháp' }}</button></div>
    <section v-if="session && !session.questions.length" class="review-empty"><h2>Chưa có mục để ôn</h2><p>Chọn phạm vi khác hoặc thêm mục học tập.</p></section>
    <section v-else-if="session && complete" class="review-summary"><h2>Tóm tắt ôn tập</h2><p>Đã nhớ: {{ summary.remembered }} · Chưa nhớ: {{ summary.not_yet }}</p><button type="button" aria-label="Lùi" @click="previous">Lùi</button><button type="button" @click="start">Ôn lại</button></section>
    <section v-else-if="current" class="review-question">
      <p>{{ position + 1 }} / {{ session?.questions.length }}</p>
      <template v-if="kind === 'vocabulary'"><div class="review-card-scene"><button type="button" class="review-card" :class="{ 'is-flipped': revealed }" aria-label="Lật thẻ" :aria-pressed="revealed" @click="revealed = !revealed"><span class="review-card-face review-card-face-front" :aria-hidden="revealed"><span class="review-card-eyebrow">MẶT TRƯỚC · CHẠM ĐỂ LẬT</span><span class="review-front">{{ front }}</span><span class="review-card-hint">↻ Lật thẻ xem đáp án</span></span><span class="review-card-face review-card-face-back" :aria-hidden="!revealed"><span class="review-card-eyebrow">MẶT SAU · CHẠM ĐỂ LẬT LẠI</span><span class="review-back"><span v-if="mode !== 'meaning'">{{ current.items[0]?.meaning }}</span><span v-if="mode !== 'chinese'" lang="zh">{{ current.items[0]?.text }}</span><span v-if="mode !== 'pinyin'">{{ current.items[0]?.pinyin }}</span></span><span class="review-card-hint">↻ Lật lại mặt trước</span></span></button></div></template>
      <template v-else><div class="review-front" lang="zh">{{ current.sentence?.text }}</div><button type="button" aria-label="Hiện Pinyin" @click="pinyinVisible = !pinyinVisible">{{ pinyinVisible ? 'Ẩn Pinyin' : 'Hiện Pinyin' }}</button><p v-if="pinyinVisible">{{ current.sentence?.pinyin }}</p><button type="button" aria-label="Xem đáp án" @click="revealed = true">Xem đáp án</button><div v-if="revealed" class="review-answer"><p>{{ current.sentence?.meaning }}</p><div v-for="entry in current.items" :key="entry.id"><strong>{{ entry.text }}</strong><p>{{ entry.meaning }}</p><p v-if="results[entry.id]" role="status">{{ results[entry.id] === 'remembered' ? 'Đã nhớ' : 'Chưa nhớ' }}</p><button type="button" :aria-label="`Chưa nhớ ${entry.text}`" :disabled="busy" @click="notYet(entry.id)">Chưa nhớ</button><button type="button" :aria-label="`Đã nhớ ${entry.text}`" :disabled="busy" @click="assess(entry.id, 'remembered')">Đã nhớ</button></div></div></template>
      <label>Ô nháp ôn tập <textarea v-model="scratchpads[position]" aria-label="Ô nháp ôn tập"></textarea></label>
      <div class="review-navigation"><button type="button" aria-label="Lùi" :disabled="position === 0 || busy" @click="previous">Lùi</button><button v-if="kind === 'vocabulary'" type="button" aria-label="Chưa nhớ" :disabled="busy" @click="notYet(current.item_ids[0]!)">Chưa nhớ</button><button type="button" aria-label="Tiếp" :disabled="busy" @click="next">Tiếp</button></div>
    </section>
    <details class="review-statistics" aria-label="Thống kê ghi nhớ"><summary>Thống kê ghi nhớ <span>Đã nhớ {{ overview.totals.remembered }} · Chưa nhớ {{ overview.totals.not_yet }}</span></summary><ul><li v-for="entry in overview.entries" :key="entry.id">{{ entry.text }} — Đã nhớ: {{ entry.remembered }} · Chưa nhớ: {{ entry.not_yet }}</li></ul></details>
  </section>
</template>
