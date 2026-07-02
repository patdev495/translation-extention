export interface PinnedSnippet {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
}

export async function addPinnedSnippet(imageUrl: string, x: number, y: number): Promise<void> {
  const res = await chrome.storage.local.get(['pinned_snippets', 'settings']);
  // Only add if ocrPinImage setting is enabled
  if (!res.settings?.ocrPinImage) return;

  const current: PinnedSnippet[] = res.pinned_snippets || [];
  const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const updated = [...current, { id, imageUrl, x, y }];
  await chrome.storage.local.set({ pinned_snippets: updated });
}

export async function updatePinnedSnippetPosition(id: string, x: number, y: number): Promise<void> {
  const res = await chrome.storage.local.get('pinned_snippets');
  const current: PinnedSnippet[] = res.pinned_snippets || [];
  const updated = current.map(s => s.id === id ? { ...s, x, y } : s);
  await chrome.storage.local.set({ pinned_snippets: updated });
}

export async function removePinnedSnippet(id: string): Promise<void> {
  const res = await chrome.storage.local.get('pinned_snippets');
  const current: PinnedSnippet[] = res.pinned_snippets || [];
  const updated = current.filter(s => s.id !== id);
  await chrome.storage.local.set({ pinned_snippets: updated });
}

export class PinnedSnippetPanel {
  private id: string;
  private wrapper: HTMLDivElement;
  private shadow: ShadowRoot;
  private cardEl!: HTMLDivElement;
  private dragHandle!: HTMLDivElement;
  private closeBtn!: HTMLButtonElement;
  private imgEl!: HTMLImageElement;

  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private initialLeft = 0;
  private initialTop = 0;

  private doc: Document;

  constructor(
    id: string,
    imageUrl: string,
    initialX: number,
    initialY: number,
    targetDoc: Document = document
  ) {
    this.id = id;
    this.doc = targetDoc;

    // 1. Create wrapper container
    this.wrapper = this.doc.createElement('div');
    this.wrapper.className = 'polytranslate-pinned-wrapper';
    this.wrapper.style.position = 'fixed';
    this.wrapper.style.left = `${initialX}px`;
    this.wrapper.style.top = `${initialY}px`;
    this.wrapper.style.zIndex = '2147483646'; // Just under tooltip

    // 2. Attach Shadow DOM
    this.shadow = this.wrapper.attachShadow({ mode: 'open' });

    // 3. Inject Stylesheet Link
    const cssUrl = chrome.runtime.getURL('popup.css');
    const link = this.doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    this.shadow.appendChild(link);

    // 4. Inject Custom Style Tag
    const style = this.doc.createElement('style');
    style.textContent = `
      .pinned-card {
        user-select: none;
      }
      .drag-handle {
        cursor: move;
      }
      img {
        max-width: 100%;
        height: auto;
      }
    `;
    this.shadow.appendChild(style);

    // 5. Render Panel HTML
    this.render(imageUrl);

    // 6. Append to document body
    this.doc.body.appendChild(this.wrapper);

    // 7. Bind Events
    this.bindEvents();
  }

  private render(imageUrl: string) {
    const content = `
      <div class="pinned-card flex flex-col bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl shadow-2xl overflow-hidden p-2.5 w-max max-w-sm transition-opacity duration-200 text-slate-800 dark:text-slate-200 font-sans">
        <!-- Header / Drag Handle -->
        <div class="drag-handle flex items-center justify-between gap-4 px-1.5 py-1 select-none border-b border-slate-200/30 dark:border-slate-800/30 mb-2">
          <div class="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5 shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v16.5m16.5-16.5v16.5M3.75 12h16.5M12 3.75v16.5" />
            </svg>
            <span class="text-[9px] font-bold tracking-wider uppercase">OCR Pinned</span>
          </div>
          <button class="close-btn text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-0.5 rounded cursor-pointer shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <!-- Cropped Image -->
        <div class="rounded-xl overflow-hidden border border-slate-200/30 dark:border-slate-800/30 bg-slate-50 dark:bg-slate-950/30 flex items-center justify-center">
          <img src="${imageUrl}" class="max-h-52 object-contain block pointer-events-none" alt="OCR Snippet" />
        </div>
      </div>
    `;

    const tempDiv = this.doc.createElement('div');
    tempDiv.innerHTML = content;
    this.cardEl = tempDiv.firstElementChild as HTMLDivElement;
    this.shadow.appendChild(this.cardEl);

    this.dragHandle = this.shadow.querySelector('.drag-handle') as HTMLDivElement;
    this.closeBtn = this.shadow.querySelector('.close-btn') as HTMLButtonElement;
    this.imgEl = this.shadow.querySelector('img') as HTMLImageElement;
  }

  private bindEvents() {
    this.dragHandle.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.initialLeft = parseFloat(this.wrapper.style.left || '0');
      this.initialTop = parseFloat(this.wrapper.style.top || '0');
      e.preventDefault();
    });

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      this.wrapper.style.left = `${this.initialLeft + dx}px`;
      this.wrapper.style.top = `${this.initialTop + dy}px`;
    };

    const onMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        const currentLeft = parseFloat(this.wrapper.style.left || '0');
        const currentTop = parseFloat(this.wrapper.style.top || '0');
        updatePinnedSnippetPosition(this.id, currentLeft, currentTop);
      }
    };

    this.doc.addEventListener('mousemove', onMouseMove);
    this.doc.addEventListener('mouseup', onMouseUp);

    this.closeBtn.addEventListener('click', () => {
      removePinnedSnippet(this.id);
      this.doc.removeEventListener('mousemove', onMouseMove);
      this.doc.removeEventListener('mouseup', onMouseUp);
    });
  }

  public getIsDragging(): boolean {
    return this.isDragging;
  }

  public updatePosition(x: number, y: number) {
    if (this.wrapper) {
      this.wrapper.style.left = `${x}px`;
      this.wrapper.style.top = `${y}px`;
    }
  }

  public destroy() {
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
  }
}

export function initPinnedSnippetsSync(targetDoc: Document = document) {
  const activePanels = new Map<string, PinnedSnippetPanel>();

  const syncSnippets = (snippets: PinnedSnippet[]) => {
    const currentIds = new Set(snippets.map(s => s.id));

    // 1. Remove deleted panels
    activePanels.forEach((panel, id) => {
      if (!currentIds.has(id)) {
        panel.destroy();
        activePanels.delete(id);
      }
    });

    // 2. Add or update panels
    snippets.forEach(snippet => {
      const existing = activePanels.get(snippet.id);
      if (!existing) {
        const panel = new PinnedSnippetPanel(snippet.id, snippet.imageUrl, snippet.x, snippet.y, targetDoc);
        activePanels.set(snippet.id, panel);
      } else {
        if (!existing.getIsDragging()) {
          existing.updatePosition(snippet.x, snippet.y);
        }
      }
    });
  };

  // Initial load
  chrome.storage.local.get(['settings', 'pinned_snippets'], (res) => {
    const settings = res.settings;
    if (settings?.ocrPinImage) {
      syncSnippets(res.pinned_snippets || []);
    }
  });

  // Listen to storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes.settings) {
      const oldVal = changes.settings.oldValue;
      const newVal = changes.settings.newValue;
      if (oldVal?.ocrPinImage !== newVal?.ocrPinImage) {
        if (!newVal?.ocrPinImage) {
          activePanels.forEach(p => p.destroy());
          activePanels.clear();
          return;
        } else {
          chrome.storage.local.get('pinned_snippets', (res) => {
            syncSnippets(res.pinned_snippets || []);
          });
        }
      }
    }

    if (changes.pinned_snippets) {
      chrome.storage.local.get('settings', (res) => {
        const settings = res.settings;
        if (settings?.ocrPinImage) {
          syncSnippets(changes.pinned_snippets.newValue || []);
        } else {
          activePanels.forEach(p => p.destroy());
          activePanels.clear();
        }
      });
    }
  });
}
