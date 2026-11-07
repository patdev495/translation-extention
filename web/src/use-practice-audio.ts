import { ref } from 'vue';

export function usePracticeAudio() {
  const sampleError = ref('');
  const samplePlaying = ref(false);
  const recordingError = ref('');
  const recordingState = ref<'idle' | 'requesting' | 'recording' | 'stopping'>('idle');
  const recordings = ref<Record<string, string>>({});
  const recordedPlaying = ref(false);
  let player: HTMLAudioElement | undefined;
  let request = 0;
  let generation = 0;
  let active: { recorder: MediaRecorder; stream: MediaStream; keep: boolean } | undefined;
  let playback = 0;
  let startTimer: ReturnType<typeof setTimeout> | undefined;

  function stopPlayback(): void {
    playback += 1;
    clearTimeout(startTimer);
    window.speechSynthesis?.cancel();
    samplePlaying.value = false;
    player?.pause();
    if (player) player.src = '';
    player = undefined;
    recordedPlaying.value = false;
  }

  function playSample(text: string): void {
    stopRecording();
    stopPlayback();
    sampleError.value = '';
    const synthesis = window.speechSynthesis;
    if (!synthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      sampleError.value = 'Trình duyệt chưa hỗ trợ đọc mẫu. Bạn vẫn có thể luyện bằng flashcard.';
      return;
    }
    const voices = synthesis.getVoices();
    const voice = voices.find(candidate => /^zh[-_]CN$/i.test(candidate.lang))
      ?? voices.find(candidate => /^(cmn([-_]|$)|zh$|zh[-_](TW|SG|Hans|Hant)([-_]|$))/i.test(candidate.lang)
        && !/[-_](HK|MO)([-_]|$)/i.test(candidate.lang));
    if (!voice) {
      sampleError.value = 'Chưa có giọng đọc tiếng Trung phổ thông. Hãy bật giọng tiếng Trung trên thiết bị rồi bấm Nghe mẫu để thử lại.';
      return;
    }
    const token = playback;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice.lang;
    utterance.voice = voice;
    const finish = () => {
      if (token !== playback) return;
      clearTimeout(startTimer);
      samplePlaying.value = false;
    };
    utterance.onstart = () => { if (token === playback) clearTimeout(startTimer); };
    utterance.onend = finish;
    utterance.onerror = event => {
      if (token !== playback || event.error === 'canceled' || event.error === 'interrupted') return;
      finish();
      sampleError.value = 'Không phát được mẫu. Bấm Nghe mẫu để thử lại.';
    };
    samplePlaying.value = true;
    startTimer = setTimeout(() => {
      if (token !== playback) return;
      stopPlayback();
      sampleError.value = 'Bấm Nghe mẫu để cho phép phát âm thanh.';
    }, 4000);
    try { synthesis.speak(utterance); }
    catch { finish(); sampleError.value = 'Không phát được mẫu. Bấm Nghe mẫu để thử lại.'; }
  }

  function stopRecording(keep = true): void {
    request += 1;
    if (!active) { recordingState.value = 'idle'; return; }
    active.keep = keep;
    recordingState.value = 'stopping';
    if (active.recorder.state !== 'inactive') active.recorder.stop();
    active.stream.getTracks().forEach(track => { if (track.readyState !== 'ended') track.stop(); });
  }

  async function startRecording(cardId: string): Promise<void> {
    if (recordingState.value !== 'idle') return;
    stopPlayback();
    recordingError.value = '';
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      recordingError.value = 'Trình duyệt chưa hỗ trợ thu âm. Hãy mở trang bằng Safari và thử lại.';
      return;
    }
    const token = ++request;
    const sessionGeneration = generation;
    recordingState.value = 'requesting';
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== request || sessionGeneration !== generation) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      // Prefer an explicit codec. Older Safari falls back to its MP4/AAC recorder.
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const capture = { recorder, stream, keep: true };
      const chunks: Blob[] = [];
      active = capture;
      recorder.addEventListener('dataavailable', event => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        capture.stream.getTracks().forEach(track => { if (track.readyState !== 'ended') track.stop(); });
        if (active === capture) { active = undefined; recordingState.value = 'idle'; }
        if (!capture.keep || generation !== sessionGeneration) return;
        if (!chunks.length) {
          recordingError.value = 'Chưa thu được âm thanh. Hãy thu lại.';
          return;
        }
        const url = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || chunks[0]!.type }));
        const previous = recordings.value[cardId];
        if (previous) URL.revokeObjectURL(previous);
        recordings.value = { ...recordings.value, [cardId]: url };
      });
      recorder.addEventListener('error', () => {
        capture.keep = false;
        stopRecording(false);
        recordingError.value = 'Thu âm bị gián đoạn. Hãy thử lại.';
      });
      recorder.start(250);
      recordingState.value = 'recording';
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (token !== request || sessionGeneration !== generation) return;
      active = undefined;
      recordingState.value = 'idle';
      recordingError.value = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Chưa được cấp quyền micro. Cho phép micro cho trang này rồi thử lại.'
        : 'Không mở được micro. Kiểm tra micro và thử lại.';
    }
  }

  async function playRecording(cardId: string): Promise<void> {
    stopPlayback();
    const url = recordings.value[cardId];
    if (!url) return;
    recordingError.value = '';
    const audio = new Audio(url);
    player = audio;
    audio.addEventListener('ended', () => { if (player === audio) recordedPlaying.value = false; });
    audio.addEventListener('error', () => {
      if (player !== audio) return;
      recordedPlaying.value = false;
      recordingError.value = 'Không phát được bản thu. Hãy thử lại hoặc thu lại.';
    });
    try { await audio.play(); if (player === audio) recordedPlaying.value = true; }
    catch {
      if (player !== audio) return;
      recordedPlaying.value = false;
      recordingError.value = 'Bấm Nghe bản thu để cho phép phát âm thanh.';
    }
  }

  function clearRecordings(): void {
    generation += 1;
    stopRecording(false);
    stopPlayback();
    Object.values(recordings.value).forEach(url => URL.revokeObjectURL(url));
    recordings.value = {};
    recordingError.value = '';
  }

  return { sampleError, samplePlaying, playSample, stopPlayback, recordingError, recordingState,
    recordings, recordedPlaying, startRecording, stopRecording, playRecording, clearRecordings };
}
