const EYE_OPEN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-[1em] h-[1em]">
  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.43 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
</svg>
`;

const EYE_SLASH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-[1em] h-[1em] opacity-60">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.893 7.893 3 3m-3-3a8.959 8.959 0 0 1-4.563 1.258m-.54-2.11a3 3 0 0 1-3.72-3.72m1.04-1.04 3.72 3.72M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9" />
</svg>
`;

const TOOLTIP_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :host {
    --primary:      #0d9488;
    --primary-glow: rgba(13,148,136,0.3);
    --secondary:    #14b8a6;
    --accent:       #f97316;
    --bg:           rgba(8, 10, 18, 0.92);
    --surface:      rgba(255,255,255,0.04);
    --border:       rgba(255,255,255,0.09);
    --border-sep:   rgba(255,255,255,0.06);
    --text-1:       #f0f4f8;
    --text-2:       #8fa3b8;
    --text-3:       #546070;
    --phonetic-src: #60a5fa;
    --phonetic-tr:  #2dd4bf;
    --success:      #22c55e;
    --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* ── Tooltip Card ── */
  #tooltip {
    font-family: var(--font);
    font-size: var(--tooltip-font-size, 14px);
    position: absolute;
    display: none;
    background: var(--bg);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 14px;
    max-width: calc(100vw - 16px);
    max-height: 90vh;
    overflow: auto;
    color: var(--text-1);
    z-index: 50;
    cursor: move;
    box-shadow:
      0 0 0 1px rgba(13,148,136,0.08),
      0 8px 32px rgba(0,0,0,0.55),
      0 2px 8px rgba(0,0,0,0.4);
    transform: translate(-50%, -50%) scale(0.94);
    opacity: 0;
    transition: opacity 0.18s ease, transform 0.22s var(--ease-spring);
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }

  #tooltip.visible {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  #tooltip::-webkit-scrollbar { width: 4px; }
  #tooltip::-webkit-scrollbar-track { background: transparent; }
  #tooltip::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

  /* ── Trigger Button ── */
  #trigger {
    position: absolute;
    width: 34px;
    height: 34px;
    background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
    border: 1px solid rgba(13,148,136,0.5);
    border-radius: 50%;
    color: #ffffff;
    cursor: pointer;
    z-index: 50;
    transform: translate(-50%, -100%);
    box-shadow: 0 0 0 0 var(--primary-glow), 0 4px 14px rgba(0,0,0,0.5);
    transition: transform 0.2s var(--ease-spring), box-shadow 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  #trigger.hidden { display: none !important; }

  #trigger:hover {
    transform: translate(-50%, -110%) scale(1.12);
    box-shadow: 0 0 0 5px var(--primary-glow), 0 6px 20px rgba(0,0,0,0.5);
  }

  #trigger svg { width: 16px; height: 16px; }

  /* ── Inner layout ── */
  .tt-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    cursor: default;
  }

  /* ── Section header row ── */
  .tt-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-sep);
    margin-bottom: 4px;
  }

  .tt-lang-badge {
    font-size: 0.62em;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border-sep);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .tt-lang-badge.src { color: var(--text-2); border-color: rgba(255,255,255,0.1); }
  .tt-lang-badge.tr1 { color: var(--primary); border-color: rgba(13,148,136,0.25); background: rgba(13,148,136,0.07); }
  .tt-lang-badge.tr2 { color: var(--accent);  border-color: rgba(249,115,22,0.25);  background: rgba(249,115,22,0.07); }

  /* ── Action buttons row ── */
  .tt-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .tt-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    background: transparent;
    border-radius: 7px;
    color: var(--text-3);
    cursor: pointer;
    transition: background 0.14s ease, color 0.14s ease, transform 0.14s ease;
    flex-shrink: 0;
  }

  .tt-btn:hover {
    background: rgba(255,255,255,0.08);
    color: var(--text-1);
    transform: scale(1.1);
  }

  .tt-btn svg { width: 1em; height: 1em; }

  .tt-btn.copy-button:hover { color: var(--secondary); }
  .tt-btn.tts-button:hover  { color: #a78bfa; }
  .tt-btn.dict-button:hover { color: var(--accent); }
  .tt-btn.phonetics-toggle-button:hover { color: var(--phonetic-src); }

  /* ── Text content ── */
  .tt-source-text {
    font-weight: 700;
    color: var(--text-1);
    line-height: 1.45;
    letter-spacing: -0.01em;
  }

  .tt-translation-text {
    font-weight: 500;
    color: #c8d8e8;
    line-height: 1.5;
  }

  .tt-phonetic {
    font-family: 'Inter', monospace;
    font-size: 0.82em;
    font-weight: 500;
    line-height: 1.4;
    letter-spacing: 0.01em;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .tt-phonetic.src { color: var(--phonetic-src); }
  .tt-phonetic.tr  { color: var(--phonetic-tr); }

  /* ── Separator ── */
  .tt-sep {
    height: 1px;
    background: var(--border-sep);
  }

  /* ── hidden util ── */
  .hidden { display: none !important; }

  /* ── Break modes ── */
  .break-words { word-break: break-word; white-space: pre-wrap; }
  .break-normal { word-break: normal; white-space: pre; }

  /* Copy success flash */
  @keyframes tt-pop {
    0%   { transform: scale(0.8); opacity: 0; }
    60%  { transform: scale(1.15); }
    100% { transform: scale(1); opacity: 1; }
  }
  .tt-copy-ok { animation: tt-pop 0.25s var(--ease-spring) both; color: var(--success) !important; }
`;

export class TranslationTooltip {
  private container: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private tooltipEl: HTMLDivElement | null = null;
  private triggerEl: HTMLButtonElement | null = null;
  
  onTriggerClick?: () => void;

  // Draggable state variables
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragInitialLeft = 0;
  private dragInitialTop = 0;

  constructor() {
    this.init();
  }

  private init() {
    const existing = document.getElementById('translation-extension-root') as HTMLDivElement;
    if (existing) {
      this.container = existing;
      this.shadow = existing.shadowRoot;
      this.tooltipEl = this.shadow?.querySelector('#tooltip') || null;
      this.triggerEl = this.shadow?.querySelector('#trigger') || null;
      return;
    }

    this.container = document.createElement('div');
    this.container.id = 'translation-extension-root';
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.zIndex = '2147483647';
    
    this.shadow = this.container.attachShadow({ mode: 'open' });

    // Inject premium CSS directly into Shadow DOM
    const style = document.createElement('style');
    style.textContent = TOOLTIP_CSS;
    this.shadow.appendChild(style);

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.id = 'tooltip';
    this.shadow.appendChild(this.tooltipEl);

    this.triggerEl = document.createElement('button');
    this.triggerEl.id = 'trigger';
    this.triggerEl.className = 'hidden';
    this.triggerEl.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-2.666-2.621a9 9 0 0 1 3.224 5.29" />
      </svg>
    `;
    this.shadow.appendChild(this.triggerEl);

    document.body.appendChild(this.container);

    // Click handler with delegation
    this.shadow.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // Handle Trigger button click
      const trigBtn = target.closest('#trigger');
      if (trigBtn && this.onTriggerClick) {
        this.hideTrigger();
        this.onTriggerClick();
        return;
      }

      // Handle Phonetics Toggle click
      const phoneticsToggleBtn = target.closest('.phonetics-toggle-button') as HTMLButtonElement | null;
      if (phoneticsToggleBtn) {
        const containers = this.shadow!.querySelectorAll('.phonetics-container');
        const currentlyVisible = containers.length > 0 ? !containers[0].classList.contains('hidden') : true;
        const newVisibleState = !currentlyVisible;

        containers.forEach(container => {
          if (newVisibleState) {
            container.classList.remove('hidden');
          } else {
            container.classList.add('hidden');
          }
        });

        // Update the button icon
        phoneticsToggleBtn.innerHTML = newVisibleState ? EYE_OPEN_SVG : EYE_SLASH_SVG;

        // Persist to chrome.storage.local
        chrome.storage.local.get('settings', (res) => {
          const settings = res.settings || {};
          settings.phoneticsVisible = newVisibleState;
          chrome.storage.local.set({ settings });
        });
        return;
      }

      // Handle Copy Button click
      const copyBtn = target.closest('.copy-button') as HTMLElement;
      if (copyBtn) {
        const text = copyBtn.getAttribute('data-text');
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.classList.add('tt-copy-ok');
            copyBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" style="width:1em;height:1em">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            `;
            setTimeout(() => {
              copyBtn.classList.remove('tt-copy-ok');
              copyBtn.innerHTML = originalHTML;
            }, 1000);
          }).catch(err => {
            console.error('Failed to copy text:', err);
          });
        }
        return;
      }

      // Handle Dictionary Button click
      const dictBtn = target.closest('.dict-button');
      if (dictBtn) {
        const text = dictBtn.getAttribute('data-text');
        const lang = dictBtn.getAttribute('data-lang');
        if (text && lang) {
          const url = this.getDictionaryUrl(text, lang);
          if (url) {
            window.open(url, '_blank');
          }
        }
        return;
      }

      // Handle TTS Button click
      const ttsBtn = target.closest('.tts-button');
      if (ttsBtn) {
        const text = ttsBtn.getAttribute('data-text');
        const lang = ttsBtn.getAttribute('data-lang');
        if (text && lang) {
          this.speak(text, lang);
        }
      }
    });

    // Draggable event handlers
    this.tooltipEl.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      // If clicking interactive elements like buttons, don't drag
      if (target.closest('button') || target.closest('select') || target.closest('input')) {
        return;
      }
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragInitialLeft = parseFloat(this.tooltipEl!.style.left || '0');
      this.dragInitialTop = parseFloat(this.tooltipEl!.style.top || '0');
      e.preventDefault(); // Prevents selection
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging || !this.tooltipEl) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.tooltipEl.style.left = `${this.dragInitialLeft + dx}px`;
      this.tooltipEl.style.top = `${this.dragInitialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
  }

  show(x: number, y: number, sourceText: string, data: any, ttsEnabled: boolean = true, phoneticsVisible: boolean = true, ocrWidth?: number) {
    if (!this.tooltipEl || !this.shadow) return;

    const { detectedLang, sourcePhonetics } = data;
    const translations = Array.isArray(data.translations)
      ? data.translations
      : [data.translation1, data.translation2].filter(Boolean);
    const [translation1, translation2] = translations;

    const getLangLabel = (l: string) => {
      const norm = l.toLowerCase().split('-')[0];
      if (norm === 'vi') return 'VIE';
      if (norm === 'en') return 'ENG';
      if (norm === 'zh') return 'CHI';
      return norm.toUpperCase();
    };

    const renderDictButton = (text: string, lang: string) => {
      const url = this.getDictionaryUrl(text, lang);
      if (!url) return '';
      const isEn = lang.toLowerCase().split('-')[0] === 'en';
      const title = isEn ? 'Open in Cambridge Dictionary' : 'Open in Hanzii Dictionary';
      return `
        <button class="tt-btn dict-button" data-text="${this.escapeHtml(text)}" data-lang="${lang}" title="${title}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1em;height:1em">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </button>
      `;
    };

    const isOcrTooltip = typeof ocrWidth === 'number' && ocrWidth > 0;
    const viewportMargin = 16;
    const contentMaxWidth = `calc(100vw - ${viewportMargin * 2}px)`;
    const tooltipMaxWidth = `calc(100vw - ${viewportMargin}px)`;
    const widthStyle = 'max-content';
    const minWidthStyle = isOcrTooltip ? `min(${ocrWidth}px, ${contentMaxWidth})` : '200px';
    const tooltipWidthStyle = 'max-content';
    const textBreakClass = isOcrTooltip ? 'break-normal' : 'break-words';

    let content = `
      <div class="tt-body" style="width:${widthStyle}; min-width:${minWidthStyle}; max-width:${contentMaxWidth};">

        <!-- Source Block -->
        <div>
          <div class="tt-section-header">
            <span class="tt-lang-badge src">${getLangLabel(detectedLang)} · Source</span>
            <div class="tt-actions">
              <button class="tt-btn phonetics-toggle-button" title="Toggle phonetics (IPA/Pinyin)">
                ${phoneticsVisible ? EYE_OPEN_SVG : EYE_SLASH_SVG}
              </button>
              <button class="tt-btn copy-button" data-text="${this.escapeHtml(sourceText)}" title="Copy source text">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1em;height:1em">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
                </svg>
              </button>
              ${renderDictButton(sourceText, detectedLang)}
              ${ttsEnabled ? `
              <button class="tt-btn tts-button" data-text="${this.escapeHtml(sourceText)}" data-lang="${detectedLang}" title="Play pronunciation">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1.1em;height:1.1em">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              </button>
              ` : ''}
            </div>
          </div>
          <span class="tt-source-text ${textBreakClass}">${this.escapeHtml(sourceText)}</span>
          ${sourcePhonetics ? `
            <div class="phonetics-container ${phoneticsVisible ? '' : 'hidden'}" style="margin-top:4px">
              <span class="tt-phonetic src">${sourcePhonetics}</span>
            </div>
          ` : ''}
        </div>

        ${translations.length > 0 ? '<div class="tt-sep"></div>' : ''}

        <!-- Translation 1 -->
        ${translation1 ? `
        <div>
          <div class="tt-section-header">
            <span class="tt-lang-badge tr1">${getLangLabel(translation1.lang)}</span>
            <div class="tt-actions">
              <button class="tt-btn copy-button" data-text="${this.escapeHtml(translation1.text)}" title="Copy translation">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1em;height:1em">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
                </svg>
              </button>
              ${renderDictButton(translation1.text, translation1.lang)}
              ${ttsEnabled ? `
              <button class="tt-btn tts-button" data-text="${this.escapeHtml(translation1.text)}" data-lang="${translation1.lang}" title="Play pronunciation">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1.1em;height:1.1em">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              </button>
              ` : ''}
            </div>
          </div>
          <span class="tt-translation-text ${textBreakClass}">${this.escapeHtml(translation1.text)}</span>
          ${translation1.phonetics ? `
            <div class="phonetics-container ${phoneticsVisible ? '' : 'hidden'}" style="margin-top:4px">
              <span class="tt-phonetic tr">${translation1.phonetics}</span>
            </div>
          ` : ''}
        </div>
        ` : ''}

        ${translation1 && translation2 ? '<div class="tt-sep"></div>' : ''}

        <!-- Translation 2 -->
        ${translation2 ? `
        <div>
          <div class="tt-section-header">
            <span class="tt-lang-badge tr2">${getLangLabel(translation2.lang)}</span>
            <div class="tt-actions">
              <button class="tt-btn copy-button" data-text="${this.escapeHtml(translation2.text)}" title="Copy translation">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1em;height:1em">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
                </svg>
              </button>
              ${renderDictButton(translation2.text, translation2.lang)}
              ${ttsEnabled ? `
              <button class="tt-btn tts-button" data-text="${this.escapeHtml(translation2.text)}" data-lang="${translation2.lang}" title="Play pronunciation">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1.1em;height:1.1em">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              </button>
              ` : ''}
            </div>
          </div>
          <span class="tt-translation-text ${textBreakClass}">${this.escapeHtml(translation2.text)}</span>
          ${translation2.phonetics ? `
            <div class="phonetics-container ${phoneticsVisible ? '' : 'hidden'}" style="margin-top:4px">
              <span class="tt-phonetic tr">${translation2.phonetics}</span>
            </div>
          ` : ''}
        </div>
        ` : ''}

      </div>
    `;

    this.tooltipEl.innerHTML = '';
    this.tooltipEl.style.width = tooltipWidthStyle;
    this.tooltipEl.style.maxWidth = tooltipMaxWidth;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = content;
    this.tooltipEl.appendChild(wrapper);

    // Always position in the center of the screen when appearing
    const centerX = window.scrollX + window.innerWidth / 2;
    const centerY = window.scrollY + window.innerHeight / 2;
    this.tooltipEl.style.left = `${centerX}px`;
    this.tooltipEl.style.top = `${centerY}px`;

    // Reset state, then trigger appear animation
    this.tooltipEl.classList.remove('hidden', 'visible');
    this.tooltipEl.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.tooltipEl!.classList.add('visible');
      });
    });
  }

  hide() {
    if (this.tooltipEl) {
      this.tooltipEl.classList.remove('visible');
      this.tooltipEl.style.display = 'none';
    }
  }

  showTrigger(x: number, y: number) {
    if (!this.triggerEl) return;
    this.triggerEl.style.left = `${x}px`;
    this.triggerEl.style.top = `${y}px`;
    this.triggerEl.classList.remove('hidden');
  }

  hideTrigger() {
    if (this.triggerEl) {
      this.triggerEl.classList.add('hidden');
    }
  }

  private getDictionaryUrl(text: string, lang: string): string | null {
    const l = lang.toLowerCase().split('-')[0];
    if (l === 'en') {
      const query = encodeURIComponent(text).replace(/%20/g, '+');
      return `https://dictionary.cambridge.org/spellcheck/english/?q=${query}`;
    } else if (l === 'zh') {
      return `https://hanzii.net/search/word/${encodeURIComponent(text)}?hl=en`;
    }
    return null;
  }

  private speak(text: string, lang: string) {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    
    let locale = 'en-US';
    const cleanLang = lang.toLowerCase();
    if (cleanLang.startsWith('zh')) {
      locale = 'zh-CN';
    } else if (cleanLang.startsWith('vi')) {
      locale = 'vi-VN';
    } else if (cleanLang.startsWith('en')) {
      locale = 'en-US';
    } else {
      locale = lang;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;

    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => {
      const voiceLang = v.lang.toLowerCase().replace('_', '-');
      return voiceLang === locale.toLowerCase() || voiceLang.startsWith(locale.split('-')[0].toLowerCase());
    });
    
    if (matchingVoice) {
      utterance.voice = matchingVoice;
      console.log(`PolyTranslate TTS: Speaking using voice: "${matchingVoice.name}" (${matchingVoice.lang})`);
    } else {
      console.warn(`PolyTranslate TTS: No matching voice found for locale "${locale}". Falling back to default system voice.`);
    }

    window.speechSynthesis.speak(utterance);
  }

  updateFontSize(size: string) {
    if (this.tooltipEl) {
      this.tooltipEl.style.setProperty('--tooltip-font-size', `${size}px`);
    }
  }

  setPointerPassthrough(enabled: boolean) {
    if (this.container) {
      this.container.style.pointerEvents = enabled ? 'none' : '';
    }
  }

  updatePhoneticsVisibility(visible: boolean) {
    if (!this.tooltipEl || !this.shadow) return;
    const containers = this.shadow.querySelectorAll('.phonetics-container');
    containers.forEach(container => {
      if (visible) {
        container.classList.remove('hidden');
      } else {
        container.classList.add('hidden');
      }
    });
    const phoneticsToggleBtn = this.shadow.querySelector('.phonetics-toggle-button');
    if (phoneticsToggleBtn) {
      phoneticsToggleBtn.innerHTML = visible ? EYE_OPEN_SVG : EYE_SLASH_SVG;
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
