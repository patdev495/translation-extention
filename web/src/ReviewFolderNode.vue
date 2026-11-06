<script setup lang="ts">
import { computed, ref } from 'vue';
import type { LearningFolder } from './api';

defineOptions({ name: 'ReviewFolderNode' });
const props = defineProps<{ folder: LearningFolder; folders: LearningFolder[]; selected: string | null }>();
const emit = defineEmits<{ select: [id: string] }>();
const children = computed(() => props.folders.filter(folder => folder.parent_id === props.folder.id));
const expanded = ref(false);
</script>

<template>
  <li class="review-folder-node">
    <div class="review-folder-row">
      <button v-if="children.length" type="button" class="review-folder-toggle" :aria-label="`${expanded ? 'Đóng' : 'Mở'} thư mục ${folder.name}`" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '▾' : '▸' }}</button>
      <span v-else class="review-folder-spacer" aria-hidden="true"></span>
      <button type="button" :data-folder-id="folder.id" :aria-current="selected === folder.id ? 'true' : undefined" @click="emit('select', folder.id)">{{ folder.name }}</button>
    </div>
    <ul v-if="expanded" class="review-folder-children">
      <ReviewFolderNode v-for="child in children" :key="child.id" :folder="child" :folders="folders" :selected="selected" @select="emit('select', $event)" />
    </ul>
  </li>
</template>
