<script setup lang="ts">
import App from './App.vue';

defineProps<{ token: string }>();
</script>

<template>
  <App :shared-token="token" />
</template>
