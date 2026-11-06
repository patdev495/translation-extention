<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { learningApi, type LearningFolder, type RecallResult, type ReviewOverview, type ReviewSession } from './api';
import ReviewFolderNode from './ReviewFolderNode.vue';
import { usePracticeAudio } from './use-practice-audio';

const props = defineProps<{ folders: LearningFolder[] }>();
const emit = defineEmits<{ openItem: [id: string] }>();
const reviewPage = ref<HTMLElement | null>(null);
const setupOpen = ref(true);
const scope = ref<string | null>(null);
const scopePicker = ref<HTMLDetailsElement | null>(null);
const rootFolders = computed(() => props.folders.filter(folder => !folder.parent_id || !props.folders.some(parent => parent.id === folder.parent_id)));
const scopeName = computed(() => props.folders.find(folder => folder.id === scope.value)?.name ?? 'Toàn bộ thư viện');
function selectScope(id: string | null): void {
  if (busy.value) return;
  scope.value = id;
  if (scopePicker.value) scopePicker.value.open = false;
}
const kind = ref<'vocabulary' | 'grammar'>('vocabulary');
const mode = ref<'meaning' | 'chinese' | 'pinyin'>('meaning');
function savedPractice(): 'classic' | 'listen' | 'speak' {
  try {
    const saved = localStorage.getItem('polytranslate.practice.style');
    if (saved === 'listen' || saved === 'speak') return saved;
  } catch { /* Preferences are optional when browser storage is unavailable. */ }
  return 'classic';
}
const practice = ref(savedPractice());
const category = ref<'word' | 'sentence' | 'all'>('all');
function savedAutoplay(): boolean {
  try { return localStorage.getItem('polytranslate.practice.autoplay') !== 'false'; } catch { return true; }
}
const autoplay = ref(savedAutoplay());
watch(autoplay, value => {
  try { localStorage.setItem('polytranslate.practice.autoplay', String(value)); } catch { /* Optional preference. */ }
});
const { sampleError, samplePlaying, playSample, stopPlayback, recordingError, recordingState,
  recordings, recordedPlaying, startRecording, stopRecording, playRecording, clearRecordings } = usePracticeAudio();
watch(practice, value => {
  revealed.value = false;
  try { localStorage.setItem('polytranslate.practice.style', value); } catch { /* Keep practicing without stored preferences. */ }
});
const overview = ref<ReviewOverview>({ entries: [], totals: { remembered: 0, not_yet: 0 } });
const session = ref<ReviewSession | null>(null);
const pending = ref<ReviewSession | null>(null);
let restoring = false;
let progressQueue: Promise<unknown> = Promise.resolve();
const position = ref(0);
const revealed = ref(false);
const pinyinVisible = ref(false);
const scratchpads = ref<Record<number, string>>({});
const results = ref<Record<string, RecallResult>>({});
const busy = ref(false);
const error = ref('');
const current = computed(() => session.value?.questions[position.value] ?? null);
watch([current, practice, autoplay], () => {
  stopRecording();
  stopPlayback();
  if (!restoring && document.visibilityState !== 'hidden' && current.value && kind.value === 'vocabulary' && practice.value === 'listen' && autoplay.value) {
    playSample(current.value.items[0]!.text);
  }
});
const complete = computed(() => !!session.value && position.value >= session.value.questions.length);
const summary = computed(() => ({
  remembered: Object.values(results.value).filter(value => value === 'remembered').length,
  not_yet: Object.values(results.value).filter(value => value === 'not_yet').length,
}));

async function refresh(): Promise<void> {
  try { overview.value = await learningApi.reviewOverview(scope.value); error.value = ''; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không tải được thống kê.'; }
}
watch(scope, () => { if (!restoring) { session.value = null; clearRecordings(); } void refresh(); });
watch(kind, () => { if (!restoring) { session.value = null; clearRecordings(); } });
watch(category, () => { if (!restoring) { session.value = null; clearRecordings(); } });
watch([practice, mode, autoplay], () => {
  if (!restoring && session.value?.kind === 'vocabulary') void saveProgress(position.value).catch(cause => {
    error.value = cause instanceof Error ? cause.message : 'Chưa lưu được tùy chọn luyện.';
  });
});
function saveProgress(target: number): Promise<unknown> {
  if (session.value?.kind !== 'vocabulary') return Promise.resolve();
  const id = session.value.id;
  const settings = { practice: practice.value, prompt_mode: mode.value, autoplay: autoplay.value };
  progressQueue = progressQueue.catch(() => {}).then(() => learningApi.progressReview(id, target, settings));
  return progressQueue;
}
function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') { stopRecording(); stopPlayback(); }
}
onMounted(() => {
  void refresh();
  void learningApi.currentReview().then(value => { if (!session.value) pending.value = value; }).catch(cause => {
    error.value = cause instanceof Error ? cause.message : 'Không tải được bài dở. Bạn có thể bắt đầu buổi mới.';
  });
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', clearRecordings);
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('pagehide', clearRecordings);
  clearRecordings();
});

async function start(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    stopRecording();
    stopPlayback();
    await progressQueue.catch(() => {});
    const started = await learningApi.startReview(kind.value, scope.value, {
      category: category.value, practice: practice.value, prompt_mode: mode.value, autoplay: autoplay.value,
    });
    clearRecordings();
    session.value = started;
    position.value = 0;
    scratchpads.value = {};
    results.value = {};
    pending.value = null;
    revealed.value = false;
    pinyinVisible.value = false;
    error.value = '';
    await refresh();
    setupOpen.value = false;
    await nextTick();
    reviewPage.value?.scrollIntoView?.({ block: 'start' });
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không bắt đầu được buổi ôn.'; }
  finally { busy.value = false; }
}
async function resume(): Promise<void> {
  if (!pending.value || busy.value) return;
  busy.value = true;
  restoring = true;
  try {
    const saved = await learningApi.getReview(pending.value.id);
    clearRecordings();
    scope.value = saved.settings?.folder_id ?? null;
    category.value = saved.settings?.category ?? 'all';
    practice.value = saved.settings?.practice ?? 'classic';
    mode.value = saved.settings?.prompt_mode ?? 'meaning';
    autoplay.value = saved.settings?.autoplay ?? true;
    kind.value = saved.kind;
    await nextTick();
    position.value = saved.position ?? 0;
    results.value = { ...saved.results };
    scratchpads.value = {};
    revealed.value = false;
    pinyinVisible.value = false;
    session.value = saved;
    setupOpen.value = false;
    pending.value = null;
    await nextTick();
    reviewPage.value?.scrollIntoView?.({ block: 'start' });
    error.value = '';
    await refresh();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không tiếp tục được bài dở.'; }
  finally { restoring = false; busy.value = false; }
}
async function record(itemId: string, result: RecallResult, target?: number): Promise<void> {
  if (!session.value) return;
  if (target === undefined) await learningApi.recordRecall(session.value.id, itemId, result);
  else {
    await progressQueue.catch(() => {});
    await learningApi.recordRecall(session.value.id, itemId, result, target);
  }
  results.value = { ...results.value, [itemId]: result };
  await refresh();
}
async function notYet(itemId: string): Promise<void> {
  await assess(itemId, 'not_yet');
}
async function assess(itemId: string, result: RecallResult): Promise<void> {
  if (busy.value || !current.value) return;
  busy.value = true;
  try {
    await record(itemId, result, kind.value === 'vocabulary' ? position.value + 1 : undefined);
    if (kind.value === 'vocabulary') advance();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không lưu được kết quả.'; }
  finally { busy.value = false; }
}
function advance(): void {
  position.value += 1;
  revealed.value = false;
  pinyinVisible.value = false;
  if (complete.value) clearRecordings();
}
async function next(): Promise<void> {
  if (!current.value || busy.value) return;
  busy.value = true;
  try {
    if (kind.value === 'vocabulary') await saveProgress(position.value + 1);
    if (kind.value === 'grammar' && revealed.value) {
      for (const id of current.value.item_ids) await record(id, kind.value === 'grammar' && results.value[id] === 'not_yet' ? 'not_yet' : 'remembered');
    }
    advance();
    error.value = '';
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không lưu được kết quả.'; }
  finally { busy.value = false; }
}
async function previous(): Promise<void> {
  if (position.value <= 0 || busy.value) return;
  busy.value = true;
  try {
    await saveProgress(position.value - 1);
    position.value -= 1;
    revealed.value = false;
    pinyinVisible.value = false;
    error.value = '';
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Chưa lưu được vị trí. Hãy thử lại.'; }
  finally { busy.value = false; }
}
async function finishPractice(): Promise<void> {
  if (!session.value || busy.value) return;
  busy.value = true;
  try {
    await saveProgress(session.value.questions.length);
    position.value = session.value.questions.length;
    clearRecordings();
    error.value = '';
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Chưa kết thúc được buổi luyện. Hãy thử lại.'; }
  finally { busy.value = false; }
}
function flipCard(): void {
  if (window.getSelection()?.toString().trim()) return;
  revealed.value = !revealed.value;
}
function onCardKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  event.stopPropagation();
  revealed.value = !revealed.value;
}
function onKeydown(event: KeyboardEvent): void {
  if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || !session.value || !current.value) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest('input, textarea, select, button, summary, a, [role="button"], [contenteditable]')) return;
  event.preventDefault();
  void next();
}
const front = computed(() => {
  const entry = current.value?.items[0];
  if (practice.value === 'listen') return 'Nghe và thử nhắc lại';
  if (practice.value === 'speak') return entry?.meaning;
  return mode.value === 'meaning' ? entry?.meaning : mode.value === 'chinese' ? entry?.text : entry?.pinyin;
});
</script>

<template>
  <section ref="reviewPage" class="review-page" :class="{ 'practice-active': current }" aria-label="Ôn tập">
    <header><h1>Ôn tập</h1><p>Ôn lại nội dung trong thư viện học tập.</p></header>
    <details class="practice-setup" :open="setupOpen" @toggle="setupOpen = ($event.target as HTMLDetailsElement).open">
      <summary>Thiết lập bài luyện <span>{{ scopeName }}</span></summary>
    <div class="review-controls">
      <div class="review-scope-control"><span>Phạm vi ôn tập</span><details ref="scopePicker" class="review-scope-picker"><summary aria-label="Phạm vi ôn tập">{{ scopeName }}</summary><div class="review-scope-menu"><button type="button" class="review-all-folders" :aria-current="scope === null ? 'true' : undefined" @click="selectScope(null)">Toàn bộ thư viện</button><ul class="review-scope-tree"><ReviewFolderNode v-for="folder in rootFolders" :key="folder.id" :folder="folder" :folders="folders" :selected="scope" @select="selectScope" /></ul></div></details></div>
      <label>Hoạt động <select v-model="kind" :disabled="busy" aria-label="Hoạt động ôn tập"><option value="vocabulary">Flashcard từ / câu</option><option value="grammar">Ôn ngữ pháp</option></select></label>
      <template v-if="kind === 'vocabulary'">
        <label>Nội dung <select v-model="category" :disabled="busy" aria-label="Nội dung luyện"><option value="all">Từ/cụm và câu</option><option value="word">Từ / cụm từ</option><option value="sentence">Câu</option></select></label>
        <label>Cách luyện <select v-model="practice" :disabled="busy" aria-label="Cách luyện"><option value="classic">Flashcard thường</option><option value="listen">Nghe và nói theo</option><option value="speak">Nhìn nghĩa và tự nói</option></select></label>
        <label v-if="practice === 'classic'">Mặt trước <select v-model="mode" :disabled="busy" aria-label="Mặt trước flashcard"><option value="meaning">Nghĩa tiếng Việt</option><option value="chinese">Chữ Trung</option><option value="pinyin">Pinyin</option></select></label>
      </template>
      <button type="button" aria-label="Bắt đầu ôn tập" :disabled="busy" @click="start">{{ session || pending ? 'Bắt đầu buổi mới' : 'Bắt đầu ôn tập' }}</button>
    </div>
    </details>
    <p v-if="error" role="alert">{{ error }}</p>
    <section v-if="pending && !session" class="practice-resume" aria-label="Bài đang dở">
      <div><strong>Bài luyện đang dở</strong><p>Thẻ {{ (pending.position ?? 0) + 1 }} / {{ pending.questions.length }} · Giữ nguyên thứ tự và kết quả.</p></div>
      <button type="button" aria-label="Tiếp tục bài dở" :disabled="busy" @click="resume">Tiếp tục bài dở →</button>
    </section>
    <div v-if="kind === 'grammar' && session?.ineligible_count" class="review-missing"><p>{{ session.ineligible_count }} mục Ngữ pháp chưa có Câu ví dụ.</p><button v-for="id in session.ineligible_item_ids" :key="id" type="button" @click="emit('openItem', id)">Thêm Câu ví dụ cho {{ overview.entries.find(entry => entry.id === id)?.text ?? 'Ngữ pháp' }}</button></div>
    <section v-if="session && !session.questions.length" class="review-empty"><h2>Chưa có mục để ôn</h2><p>Chọn phạm vi khác hoặc thêm mục học tập.</p></section>
    <section v-else-if="session && complete" class="review-summary"><h2>Tóm tắt ôn tập</h2><p>Đã nhớ: {{ summary.remembered }} · Chưa nhớ: {{ summary.not_yet }}</p><button type="button" aria-label="Lùi" @click="previous">Lùi</button><button type="button" @click="start">Ôn lại</button></section>
    <section v-else-if="current" class="review-question">
      <div class="practice-progress"><p>{{ position + 1 }} / {{ session?.questions.length }} <span v-if="kind === 'vocabulary'">{{ current.items[0]?.category === 'sentence' ? 'CÂU' : 'TỪ / CỤM' }}</span></p><button v-if="kind === 'vocabulary'" type="button" aria-label="Kết thúc luyện" :disabled="busy" @click="finishPractice">Kết thúc</button></div>
      <template v-if="kind === 'vocabulary'">
        <div class="review-card-scene"><div class="review-card" :class="{ 'is-flipped': revealed }" role="button" tabindex="0" aria-label="Lật thẻ" :aria-pressed="revealed" @click="flipCard" @keydown="onCardKeydown"><span class="review-card-face review-card-face-front" :aria-hidden="revealed"><span class="review-card-eyebrow">MẶT TRƯỚC · CHẠM ĐỂ LẬT</span><span class="review-front">{{ front }}</span><span class="review-card-hint">↻ Lật thẻ xem đáp án</span></span><span class="review-card-face review-card-face-back" :aria-hidden="!revealed"><span class="review-card-eyebrow">MẶT SAU · CHẠM ĐỂ LẬT LẠI</span><span class="review-back"><span v-if="practice !== 'classic' || mode !== 'meaning'">{{ current.items[0]?.meaning }}</span><span v-if="practice !== 'classic' || mode !== 'chinese'" lang="zh">{{ current.items[0]?.text }}</span><span v-if="practice !== 'classic' || mode !== 'pinyin'">{{ current.items[0]?.pinyin }}</span></span><span class="review-card-hint">↻ Lật lại mặt trước</span></span></div></div>
        <div class="practice-audio" role="group" aria-label="Nghe và thu âm">
          <button type="button" aria-label="Nghe mẫu" @click="playSample(current.items[0]!.text)">{{ samplePlaying ? '↻ Nghe lại mẫu' : '▶ Nghe mẫu' }}</button>
          <button type="button" :aria-label="recordingState === 'recording' ? 'Dừng thu âm' : 'Thu âm'" :aria-pressed="recordingState === 'recording'" :disabled="recordingState === 'requesting' || recordingState === 'stopping'" @click="recordingState === 'recording' ? stopRecording() : startRecording(current.item_ids[0]!)">{{ recordingState === 'recording' ? '■ Dừng thu' : recordingState === 'requesting' ? 'Đang mở micro…' : recordingState === 'stopping' ? 'Đang xử lý…' : '● Thu âm' }}</button>
          <button type="button" aria-label="Nghe bản thu" :disabled="!recordings[current.item_ids[0]!] || recordingState !== 'idle'" @click="playRecording(current.item_ids[0]!)">{{ recordedPlaying ? '↻ Nghe lại' : '▷ Bản thu' }}</button>
          <label v-if="practice === 'listen'" class="practice-autoplay"><input v-model="autoplay" :disabled="busy" type="checkbox" aria-label="Tự phát mẫu" /> Tự phát mẫu</label>
        </div>
        <p v-if="sampleError" class="practice-feedback" role="status">{{ sampleError }}</p>
        <p v-if="recordingError" class="practice-feedback" role="status">{{ recordingError }}</p>
        <p class="practice-recording-note" role="status">{{ recordingState === 'recording' ? 'Đang thu âm — bấm Dừng thu khi nói xong.' : 'Bản thu chỉ giữ tạm trong buổi luyện.' }}</p>
      </template>
      <template v-else><div class="review-front" lang="zh">{{ current.sentence?.text }}</div><button type="button" aria-label="Hiện Pinyin" @click="pinyinVisible = !pinyinVisible">{{ pinyinVisible ? 'Ẩn Pinyin' : 'Hiện Pinyin' }}</button><p v-if="pinyinVisible">{{ current.sentence?.pinyin }}</p><button type="button" aria-label="Xem đáp án" @click="revealed = true">Xem đáp án</button><div v-if="revealed" class="review-answer"><p>{{ current.sentence?.meaning }}</p><div v-for="entry in current.items" :key="entry.id"><strong>{{ entry.text }}</strong><p>{{ entry.meaning }}</p><p v-if="results[entry.id]" role="status">{{ results[entry.id] === 'remembered' ? 'Đã nhớ' : 'Chưa nhớ' }}</p><button type="button" :aria-label="`Chưa nhớ ${entry.text}`" :disabled="busy" @click="notYet(entry.id)">Chưa nhớ</button><button type="button" :aria-label="`Đã nhớ ${entry.text}`" :disabled="busy" @click="assess(entry.id, 'remembered')">Đã nhớ</button></div></div></template>
      <div class="review-navigation"><button type="button" aria-label="Lùi" :disabled="position === 0 || busy" @click="previous">← Lùi</button><button v-if="kind === 'vocabulary'" class="practice-not-yet" type="button" aria-label="Chưa nhớ" :disabled="busy" @click="notYet(current.item_ids[0]!)">Chưa nhớ</button><button v-if="kind === 'vocabulary'" class="practice-remembered" type="button" aria-label="Nhớ" :disabled="busy" @click="assess(current.item_ids[0]!, 'remembered')">Nhớ ✓</button><button type="button" aria-label="Tiếp" :disabled="busy" @click="next">Tiếp →</button></div>
      <p v-if="kind === 'vocabulary' && results[current.item_ids[0]!]" class="practice-current-result" role="status">Đã đánh dấu: {{ results[current.item_ids[0]!] === 'remembered' ? 'Nhớ' : 'Chưa nhớ' }}</p>
      <details class="practice-scratchpad"><summary>Ô nháp ôn tập <span>Không bắt buộc</span></summary><label>Thử viết câu trả lời <textarea v-model="scratchpads[position]" aria-label="Ô nháp ôn tập"></textarea></label></details>
    </section>
    <details class="review-statistics" aria-label="Thống kê ghi nhớ"><summary>Thống kê ghi nhớ <span>Đã nhớ {{ overview.totals.remembered }} · Chưa nhớ {{ overview.totals.not_yet }}</span></summary><ul><li v-for="entry in overview.entries" :key="entry.id">{{ entry.text }} — Đã nhớ: {{ entry.remembered }} · Chưa nhớ: {{ entry.not_yet }}</li></ul></details>
  </section>
</template>
