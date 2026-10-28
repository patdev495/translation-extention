// Development only: extension APIs for the real popup and viewer on the Vite server.
// This file is never part of any production entry point.
(() => {
  if (globalThis.chrome?.storage?.local) return;
  const listeners = new Set();
  const store = JSON.parse(sessionStorage.getItem('polytranslate-preview') || '{"active":true}');
  const local = {
    get(keys, callback) {
      const names = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(store);
      const result = Object.fromEntries(names.map(key => [key, store[key]]));
      callback?.(result);
      return Promise.resolve(result);
    },
    set(values, callback) {
      const changes = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { oldValue: store[key], newValue: value }]));
      Object.assign(store, values);
      sessionStorage.setItem('polytranslate-preview', JSON.stringify(store));
      for (const listener of listeners) listener(changes, 'local');
      callback?.();
      return Promise.resolve();
    },
  };
  globalThis.chrome = {
    storage: { local, onChanged: { addListener: listener => listeners.add(listener), removeListener: listener => listeners.delete(listener) } },
    runtime: {
      getURL: path => new URL('/' + path, location.origin).href,
      onMessage: { addListener() {}, removeListener() {} },
      sendMessage(_message, callback) { callback?.({ success: true }); return Promise.resolve({ success: true }); },
    },
    tabs: {
      query(_query, callback) { callback?.([]); return Promise.resolve([]); },
      sendMessage() { return Promise.resolve(); },
    },
  };
})();
