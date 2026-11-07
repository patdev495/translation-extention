const TAB_STORAGE_KEY = 'settingsPopupTab';

export function initializeSettingsTabs(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  let interacted = false;

  function activate(tab: HTMLButtonElement): void {
    for (const candidate of tabs) {
      const selected = candidate === tab;
      candidate.setAttribute('aria-selected', String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(candidate.getAttribute('aria-controls')!);
      if (panel) panel.hidden = !selected;
    }
  }

  function select(tab: HTMLButtonElement): void {
    interacted = true;
    activate(tab);
    tab.focus();
    void chrome.storage.local.set({ [TAB_STORAGE_KEY]: tab.id }).catch((error) => {
      console.warn('Could not remember the settings tab:', error);
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      let nextIndex: number;
      switch (event.key) {
        case 'ArrowRight': nextIndex = (index + 1) % tabs.length; break;
        case 'ArrowLeft': nextIndex = (index - 1 + tabs.length) % tabs.length; break;
        case 'Home': nextIndex = 0; break;
        case 'End': nextIndex = tabs.length - 1; break;
        default: return;
      }
      event.preventDefault();
      select(tabs[nextIndex]);
    });
  });

  void chrome.storage.local.get(TAB_STORAGE_KEY).then((stored) => {
    // A slow storage read must not override a tab the user has already chosen.
    if (interacted) return;
    const tab = tabs.find((candidate) => candidate.id === stored[TAB_STORAGE_KEY]);
    if (tab) activate(tab);
  }).catch((error) => {
    console.warn('Could not restore the settings tab:', error);
  });
}
