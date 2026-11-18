import { createApp, h, onMounted, onUnmounted, ref } from 'vue';
import App from './App.vue';
import SharedFolder from './SharedFolder.vue';
import './style.css';

function shareToken(): string | null {
  return new URLSearchParams(window.location.hash.slice(1)).get('share');
}

createApp({
  setup() {
    const token = ref(shareToken());
    const updateShare = () => { token.value = shareToken(); };
    onMounted(() => window.addEventListener('hashchange', updateShare));
    onUnmounted(() => window.removeEventListener('hashchange', updateShare));
    return () => token.value === null ? h(App) : h(SharedFolder, { key: token.value, token: token.value });
  },
}).mount('#app');
