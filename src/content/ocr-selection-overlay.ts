export interface OcrSelectionOverlayOptions {
  isPdfMode?: boolean;
  shadowMode?: boolean;
  onSelectionComplete: (
    rect: {
      left: number;
      top: number;
      width: number;
      height: number;
      devicePixelRatio?: number;
    },
    extra?: {
      canvas?: HTMLCanvasElement;
      wrapper?: HTMLElement;
    }
  ) => void;
  onCancel?: () => void;
}

export class OcrSelectionOverlay {
  private options: OcrSelectionOverlayOptions;
  private rootElement: HTMLElement;
  private isActive = false;
  private isSelecting = false;
  private startX = 0;
  private startY = 0;

  // DOM elements
  private overlayContainer: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private selectionBox: HTMLDivElement | null = null;
  private progressIndicator: HTMLDivElement | null = null;

  // PDF-specific active page state
  private activePageWrapper: HTMLElement | null = null;
  private activePageCanvas: HTMLCanvasElement | null = null;

  // Event listener references for cleanup
  private mousedownRef = (e: MouseEvent) => this.handleMouseDown(e);
  private mousemoveRef = (e: MouseEvent) => this.handleMouseMove(e);
  private mouseupRef = (e: MouseEvent) => this.handleMouseUp(e);
  private keydownRef = (e: KeyboardEvent) => this.handleKeyDown(e);

  constructor(rootElement: HTMLElement, options: OcrSelectionOverlayOptions) {
    this.rootElement = rootElement;
    this.options = options;
  }

  public start(): void {
    if (this.isActive) return;
    this.isActive = true;

    if (this.options.shadowMode) {
      this.initShadowOverlay();
    } else {
      // Direct event binding on root element (e.g. viewer container)
      this.rootElement.addEventListener('mousedown', this.mousedownRef, true);
      this.rootElement.addEventListener('mousemove', this.mousemoveRef, true);
      window.addEventListener('mouseup', this.mouseupRef, true);
    }

    document.addEventListener('keydown', this.keydownRef, true);
  }

  public stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.isSelecting = false;

    // Remove event listeners
    if (this.options.shadowMode) {
      if (this.overlayContainer) {
        this.overlayContainer.remove();
        this.overlayContainer = null;
        this.shadow = null;
      }
    } else {
      this.rootElement.removeEventListener('mousedown', this.mousedownRef, true);
      this.rootElement.removeEventListener('mousemove', this.mousemoveRef, true);
      window.removeEventListener('mouseup', this.mouseupRef, true);
    }

    document.removeEventListener('keydown', this.keydownRef, true);

    this.removeProgress();
    this.removeSelectionBox();
    this.activePageWrapper = null;
    this.activePageCanvas = null;
  }

  private initShadowOverlay(): void {
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'polytranslate-ocr-overlay-root';
    this.overlayContainer.style.position = 'fixed';
    this.overlayContainer.style.inset = '0';
    this.overlayContainer.style.zIndex = '2147483640';
    this.overlayContainer.style.pointerEvents = 'auto';

    this.shadow = this.overlayContainer.attachShadow({ mode: 'open' });

    // Styles for Shadow DOM
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.2);
        cursor: crosshair;
        user-select: none;
        box-sizing: border-box;
      }
      .selection-box {
        position: absolute;
        border: 2px solid #89b4fa;
        background: rgba(137, 180, 250, 0.16);
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
        pointer-events: none;
        box-sizing: border-box;
      }
      .ocr-progress-indicator {
        position: absolute;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        max-width: 320px;
        min-height: 28px;
        padding: 6px 12px;
        border-radius: 8px;
        background: rgba(30, 30, 46, 0.96);
        border: 1px solid rgba(137, 180, 250, 0.35);
        color: #cdd6f4;
        font-size: 13px;
        line-height: 1.3;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        box-sizing: border-box;
        z-index: 10;
      }
      .mini-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid #313244;
        border-top-color: #89b4fa;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        flex: 0 0 auto;
        box-sizing: border-box;
      }
    `;
    this.shadow.appendChild(styleEl);

    const overlayEl = document.createElement('div');
    overlayEl.className = 'overlay';
    this.shadow.appendChild(overlayEl);

    overlayEl.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    overlayEl.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));

    document.body.appendChild(this.overlayContainer);
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return; // Left click only

    if (this.options.isPdfMode) {
      const wrapper = (e.target as Element | null)?.closest('.page-wrapper') as HTMLElement | null;
      if (!wrapper) return;
      const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
      if (!canvas) return;

      e.preventDefault();
      e.stopPropagation();
      window.getSelection()?.removeAllRanges();

      this.activePageWrapper = wrapper;
      this.activePageCanvas = canvas;

      const point = this.getPointInPage(wrapper, e);
      this.startX = point.x;
      this.startY = point.y;

      this.selectionBox = document.createElement('div');
      this.selectionBox.className = 'ocr-selection-box';
      wrapper.appendChild(this.selectionBox);

      this.updateSelectionBoxSize(this.startX, this.startY, this.startX, this.startY);
      this.isSelecting = true;
    } else if (this.options.shadowMode && this.shadow) {
      e.preventDefault();
      e.stopPropagation();

      this.startX = e.clientX;
      this.startY = e.clientY;

      this.selectionBox = document.createElement('div');
      this.selectionBox.className = 'selection-box';
      this.shadow.appendChild(this.selectionBox);

      this.updateSelectionBoxSize(this.startX, this.startY, this.startX, this.startY);
      this.isSelecting = true;
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isSelecting || !this.selectionBox) return;

    if (this.options.isPdfMode && this.activePageWrapper) {
      e.preventDefault();
      const point = this.getPointInPage(this.activePageWrapper, e);
      this.updateSelectionBoxSize(this.startX, this.startY, point.x, point.y);
    } else if (this.options.shadowMode) {
      e.preventDefault();
      this.updateSelectionBoxSize(this.startX, this.startY, e.clientX, e.clientY);
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.isSelecting || !this.selectionBox) return;
    this.isSelecting = false;

    let left = 0;
    let top = 0;
    let width = 0;
    let height = 0;

    if (this.options.isPdfMode && this.activePageWrapper && this.activePageCanvas) {
      e.preventDefault();
      const point = this.getPointInPage(this.activePageWrapper, e);
      left = Math.min(this.startX, point.x);
      top = Math.min(this.startY, point.y);
      width = Math.abs(point.x - this.startX);
      height = Math.abs(point.y - this.startY);

      if (width < 8 || height < 8) {
        this.removeSelectionBox();
        return;
      }

      this.removeSelectionBox();
      this.options.onSelectionComplete(
        { left, top, width, height },
        { canvas: this.activePageCanvas, wrapper: this.activePageWrapper }
      );
    } else if (this.options.shadowMode && this.shadow) {
      left = Math.min(this.startX, e.clientX);
      top = Math.min(this.startY, e.clientY);
      width = Math.abs(e.clientX - this.startX);
      height = Math.abs(e.clientY - this.startY);

      if (width < 8 || height < 8) {
        this.removeSelectionBox();
        return;
      }

      // Hide overlay to not capture it in screenshots
      const overlayEl = this.shadow.querySelector('.overlay') as HTMLDivElement | null;
      if (overlayEl) overlayEl.style.display = 'none';
      this.selectionBox.style.display = 'none';

      this.options.onSelectionComplete({
        left,
        top,
        width,
        height,
        devicePixelRatio: window.devicePixelRatio,
      });
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.options.onCancel?.();
      this.stop();
    }
  }

  public showProgress(message: string, position: { left: number; top: number }): void {
    this.removeProgress();

    this.progressIndicator = document.createElement('div');
    this.progressIndicator.className = 'ocr-progress-indicator';
    this.progressIndicator.innerHTML = `
      <div class="mini-spinner"></div>
      <span class="progress-text">${message}</span>
    `;

    if (this.options.isPdfMode && this.activePageWrapper) {
      this.progressIndicator.style.left = `${position.left}px`;
      this.progressIndicator.style.top = `${Math.max(8, position.top - 34)}px`;
      this.activePageWrapper.appendChild(this.progressIndicator);
    } else if (this.options.shadowMode && this.shadow) {
      this.progressIndicator.style.left = `${Math.max(8, position.left)}px`;
      this.progressIndicator.style.top = `${position.top + 8}px`;
      this.shadow.appendChild(this.progressIndicator);
    }
  }

  public updateProgressText(message: string): void {
    if (!this.progressIndicator) return;
    const textEl = this.progressIndicator.querySelector('.progress-text') || this.progressIndicator.querySelector('span:last-child');
    if (textEl) {
      textEl.textContent = message;
    }
  }

  public removeProgress(): void {
    if (this.progressIndicator) {
      this.progressIndicator.remove();
      this.progressIndicator = null;
    }
    // Backup: clean up any rogue indicators in PDF mode
    if (this.options.isPdfMode) {
      document.querySelectorAll('.ocr-progress-indicator').forEach((el) => el.remove());
    }
  }

  private removeSelectionBox(): void {
    if (this.selectionBox) {
      this.selectionBox.remove();
      this.selectionBox = null;
    }
  }

  private updateSelectionBoxSize(x1: number, y1: number, x2: number, y2: number): void {
    if (!this.selectionBox) return;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    this.selectionBox.style.left = `${left}px`;
    this.selectionBox.style.top = `${top}px`;
    this.selectionBox.style.width = `${width}px`;
    this.selectionBox.style.height = `${height}px`;
  }

  private getPointInPage(wrapper: HTMLElement, event: MouseEvent): { x: number; y: number } {
    const rect = wrapper.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(event.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(event.clientY - rect.top, rect.height)),
    };
  }
}
