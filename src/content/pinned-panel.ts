import PINNED_CSS from '../ui/pinned.css?inline';

export interface PinnedSnippet {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export async function addPinnedSnippet(
  imageUrl: string,
  x: number,
  y: number,
  width?: number,
  height?: number
): Promise<void> {
  const res = await chrome.storage.local.get(['pinned_snippets', 'settings']);
  // Only add if ocrPinImage setting is enabled
  if (!res.settings?.ocrPinImage) return;

  const current: PinnedSnippet[] = res.pinned_snippets || [];
  const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const updated = [...current, { id, imageUrl, x, y, width, height }];
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
  private width?: number;
  private height?: number;

  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private initialLeft = 0;
  private initialTop = 0;
  private resizeRef = () => this.constrainPosition();

  private doc: Document;

  constructor(
    id: string,
    imageUrl: string,
    initialX: number,
    initialY: number,
    width?: number,
    height?: number,
    targetDoc: Document = document
  ) {
    this.id = id;
    this.width = width;
    this.height = height;
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

    // Styles are bundled with the isolated panel.
    const style = this.doc.createElement('style');
    style.textContent = PINNED_CSS;
    this.shadow.appendChild(style);

    // 5. Render Panel HTML
    this.render(imageUrl);

    // 6. Append to document body
    this.doc.body.appendChild(this.wrapper);
    this.constrainPosition();
    this.doc.defaultView?.addEventListener('resize', this.resizeRef);

    // 7. Bind Events
    this.bindEvents();
  }

  private render(imageUrl: string) {
    const content = `
      <div class="pinned-card">
        <!-- Header / Drag Handle -->
        <div class="drag-handle">
          <div class="pinned-title">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5 shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v16.5m16.5-16.5v16.5M3.75 12h16.5M12 3.75v16.5" />
            </svg>
            <span>Pinned image</span>
          </div>
          <button class="close-btn" type="button" aria-label="Remove pinned image" title="Remove pinned image">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <!-- Cropped Image -->
        <div class="snippet-image" style="${this.width ? `width: ${this.width}px; height: ${this.height}px;` : ''}">
          <img src="${imageUrl}" class="object-contain block pointer-events-none" style="${this.width ? `width: ${this.width}px; height: ${this.height}px;` : 'max-height: 208px;'}" alt="OCR Snippet" />
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
      this.constrainPosition();
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

  private constrainPosition(): void {
    const view = this.doc.defaultView;
    if (!view) return;
    const rectangle = this.wrapper.getBoundingClientRect();
    const left = Math.max(8, Math.min(rectangle.left, view.innerWidth - rectangle.width - 8));
    const top = Math.max(8, Math.min(rectangle.top, view.innerHeight - Math.min(rectangle.height, view.innerHeight - 16) - 8));
    this.wrapper.style.left = `${left}px`;
    this.wrapper.style.top = `${top}px`;
  }

  public updatePosition(x: number, y: number) {
    if (this.wrapper) {
      this.wrapper.style.left = `${x}px`;
      this.wrapper.style.top = `${y}px`;
      this.constrainPosition();
    }
  }

  public destroy() {
    this.doc.defaultView?.removeEventListener('resize', this.resizeRef);
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
        const panel = new PinnedSnippetPanel(
          snippet.id,
          snippet.imageUrl,
          snippet.x,
          snippet.y,
          snippet.width,
          snippet.height,
          targetDoc
        );
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
