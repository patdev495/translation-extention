<script setup lang="ts">
import { Square, Volume2 } from '@lucide/vue';

defineProps<{ text: string; playing: boolean }>();
defineEmits<{ play: [] }>();
</script>

<template>
  <button type="button" class="library-pronunciation-button" :aria-label="`${playing ? 'Dừng phát âm' : 'Phát âm'} ${text}`" :aria-pressed="playing" :title="playing ? 'Dừng phát âm' : 'Nghe phát âm'" @click="$emit('play')">
    <Square v-if="playing" :size="17" aria-hidden="true" />
    <Volume2 v-else :size="19" aria-hidden="true" />
  </button>
</template>
