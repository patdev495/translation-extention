import TOOLTIP_CSS from '../ui/tooltip.css?inline';
import HanziWriter, { type CharacterJson } from 'hanzi-writer';
import BREAKDOWN_CSS from '../ui/hanzi-breakdown.css?inline';
import { getHanziBreakdown } from '../services/hanzi-breakdown';
import {
  getHanziMemoryNote, getPersonalHanziMeaning, getUnidentifiedStrokeExplanation,
  saveHanziMemoryNote, savePersonalHanziMeaning, saveUnidentifiedStrokeExplanation,
} from '../services/hanzi-learning';

const EYE_OPEN_SVG = `
<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-[1em] h-[1em]">
  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.43 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
</svg>
`;

const EYE_SLASH_SVG = `
<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-[1em] h-[1em] opacity-60">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.893 7.893 3 3m-3-3a8.959 8.959 0 0 1-4.563 1.258m-.54-2.11a3 3 0 0 1-3.72-3.72m1.04-1.04 3.72 3.72M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9" />
</svg>
`;

const EDIT_MEANING_SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4L16.5 3.5Z"/></svg>';
const SWITCH_MEANING_SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h15l-3-3"/><path d="m19 7-3 3"/><path d="M20 17H5l3-3"/><path d="m5 17 3 3"/></svg>';

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
  private hanziWriters = new Map<HTMLButtonElement, HanziWriter>();
  private hanziDataCache = new Map<string, Promise<CharacterJson>>();
  private hanziSelectionStart: Element | null = null;
  private hanziStrokeSpeed = 2;
  private hanziBreakdownEnabled = false;
  private hanziBreakdownLanguage: 'vi' | 'en' = 'vi';
  private breakdownRoot: HTMLDivElement | null = null;
  private breakdownCharacter: string | null = null;
  private breakdownPath: string[] = [];
  private breakdownRequest = 0;
  private breakdownDragCleanup: (() => void) | null = null;
  private breakdownPositionLocked = false;

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

    // Inject isolated UI styles directly into Shadow DOM
    const style = document.createElement('style');
    style.textContent = TOOLTIP_CSS;
    this.shadow.appendChild(style);

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.id = 'tooltip';
    this.shadow.appendChild(this.tooltipEl);

    this.triggerEl = document.createElement('button');
    this.triggerEl.id = 'trigger';
    this.triggerEl.type = 'button';
    this.triggerEl.setAttribute('aria-label', 'Translate selection');
    this.triggerEl.className = 'hidden';
    this.triggerEl.innerHTML = `
      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-2.666-2.621a9 9 0 0 1 3.224 5.29" />
      </svg>
    `;
    this.shadow.appendChild(this.triggerEl);

    document.body.appendChild(this.container);

    // Click handler with delegation
    this.shadow.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;

      const hanziButton = target.closest<HTMLButtonElement>('.tt-hanzi-button');
      if (hanziButton) {
        const looping = hanziButton.getAttribute('aria-pressed') === 'true';
        hanziButton.setAttribute('aria-pressed', String(!looping));
        const writer = this.hanziWriters.get(hanziButton);
        if (writer) {
          if (looping) {
            void writer.showCharacter({ duration: 0 });
          } else {
            void writer.loopCharacterAnimation();
          }
        }
        const character = hanziButton.querySelector('.tt-hanzi-fallback')?.textContent ?? '';
        if (looping && this.breakdownCharacter === character) {
          this.closeHanziBreakdown();
        } else if (!looping && this.hanziBreakdownEnabled && character) {
          void this.showHanziBreakdown(character);
        }
        return;
      }
      
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
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" style="width:1em;height:1em">
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

    this.shadow.addEventListener('mousedown', (event) => {
      const target = event.target as Element;
      const textElement = target.closest('.tt-source-text, .tt-translation-text, .tt-phonetic');
      this.hanziSelectionStart = textElement && this.tooltipEl?.contains(textElement) ? textElement : null;
    });

    this.shadow.addEventListener('mouseup', (event) => {
      const target = event.target as Element;
      const textElement = this.hanziSelectionStart ?? target.closest('.tt-source-text, .tt-translation-text, .tt-phonetic');
      this.hanziSelectionStart = null;
      if (!textElement || !this.tooltipEl?.contains(textElement)) return;
      const section = textElement.closest('.tt-section');
      const lang = section?.getAttribute('data-lang')?.toLowerCase() ?? '';
      if (!section || (!lang.startsWith('zh') && !lang.startsWith('en'))) return;
      // Chrome retargets window Selection endpoints to BODY for native selections
      // inside a shadow root, so read the shadow-local Selection when available.
      const selection = (this.shadow as ShadowRoot & { getSelection?: () => Selection | null })
        .getSelection?.() ?? window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) return;
      if (!selection.anchorNode || !selection.focusNode
        || !textElement.contains(selection.anchorNode)
        || !textElement.contains(selection.focusNode)) return;
      const mappedCharacters = this.highlightReading(section, textElement, selection, lang);
      if (lang.startsWith('zh')) {
        const characters = textElement.matches('.tt-phonetic')
          ? mappedCharacters
          : selection.toString().match(/\p{Script=Han}/gu);
        if (characters?.length) this.showHanziChoices(section, characters);
      }
    });

    // Draggable event handlers
    this.tooltipEl.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      // Let users select tooltip text without starting a drag.
      if (target.closest('button, select, input, .tt-source-text, .tt-translation-text, .tt-phonetic, .tt-lang-badge')) {
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
    this.stopHanziAnimations();

    const { detectedLang, sourcePhonetics } = data;
    const translations = Array.isArray(data.translations)
      ? data.translations
      : [data.translation1, data.translation2].filter(Boolean);
    const [translation1, translation2] = translations;

    const getLangLabel = (l: string) => {
      const norm = l.toLowerCase().split('-')[0];
      if (norm === 'vi') return 'Vietnamese';
      if (norm === 'en') return 'English';
      if (norm === 'zh') return 'Chinese';
      return norm.toUpperCase();
    };

    const renderDictButton = (text: string, lang: string) => {
      const url = this.getDictionaryUrl(text, lang);
      if (!url) return '';
      const isEn = lang.toLowerCase().split('-')[0] === 'en';
      const title = isEn ? 'Open in Cambridge Dictionary' : 'Open in Hanzii Dictionary';
      return `
        <button type="button" class="tt-btn dict-button" data-text="${this.escapeHtml(text)}" data-lang="${lang}" title="${title}" aria-label="${title}">
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1em;height:1em">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </button>
      `;
    };

    const isOcrTooltip = typeof ocrWidth === 'number' && ocrWidth > 0;
    const viewportMargin = 16;
    const contentMaxWidth = `${Math.max(0, window.innerWidth - viewportMargin * 4)}px`;
    const tooltipMaxWidth = `${Math.max(0, window.innerWidth - viewportMargin * 2)}px`;
    const widthStyle = 'max-content';
    const minWidthStyle = `min(${Math.max(350, ocrWidth ?? 0)}px, ${contentMaxWidth})`;
    const tooltipWidthStyle = 'max-content';
    const textBreakClass = isOcrTooltip ? 'break-normal' : 'break-words';

    let content = `
      <div class="tt-body" style="width:${widthStyle}; min-width:${minWidthStyle}; max-width:${contentMaxWidth};">

        <!-- Source Block -->
        <div class="tt-section" data-lang="${this.escapeHtml(detectedLang)}">
          <div class="tt-section-header">
            <span class="tt-lang-badge src">${getLangLabel(detectedLang)}</span>
            <div class="tt-actions">
              <button type="button" class="tt-btn phonetics-toggle-button" title="Toggle phonetics (IPA/Pinyin)" aria-label="Toggle phonetics (IPA/Pinyin)">
                ${phoneticsVisible ? EYE_OPEN_SVG : EYE_SLASH_SVG}
              </button>
              <button type="button" class="tt-btn copy-button" data-text="${this.escapeHtml(sourceText)}" title="Copy source text" aria-label="Copy source text">
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1em;height:1em">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
                </svg>
              </button>
              ${renderDictButton(sourceText, detectedLang)}
              ${ttsEnabled ? `
              <button type="button" class="tt-btn tts-button" data-text="${this.escapeHtml(sourceText)}" data-lang="${detectedLang}" title="Play pronunciation" aria-label="Play pronunciation">
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1.1em;height:1.1em">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              </button>
              ` : ''}
            </div>
          </div>
          <span class="tt-source-text ${textBreakClass}">${this.escapeHtml(sourceText)}</span>
          ${sourcePhonetics ? `
            <div class="phonetics-container ${phoneticsVisible ? '' : 'hidden'}" >
              <span class="tt-phonetic src">${sourcePhonetics}</span>
            </div>
          ` : ''}
        </div>

        ${translations.length > 0 ? '<div class="tt-sep"></div>' : ''}

        <!-- Translation 1 -->
        ${translation1 ? `
        <div class="tt-section" data-lang="${this.escapeHtml(translation1.lang)}">
          <div class="tt-section-header">
            <span class="tt-lang-badge tr1">${getLangLabel(translation1.lang)}</span>
            <div class="tt-actions">
              <button type="button" class="tt-btn copy-button" data-text="${this.escapeHtml(translation1.text)}" title="Copy translation" aria-label="Copy translation">
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1em;height:1em">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
                </svg>
              </button>
              ${renderDictButton(translation1.text, translation1.lang)}
              ${ttsEnabled ? `
              <button type="button" class="tt-btn tts-button" data-text="${this.escapeHtml(translation1.text)}" data-lang="${translation1.lang}" title="Play pronunciation" aria-label="Play pronunciation">
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1.1em;height:1.1em">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              </button>
              ` : ''}
            </div>
          </div>
          <span class="tt-translation-text ${textBreakClass}">${this.escapeHtml(translation1.text)}</span>
          ${translation1.phonetics ? `
            <div class="phonetics-container ${phoneticsVisible ? '' : 'hidden'}" >
              <span class="tt-phonetic tr">${translation1.phonetics}</span>
            </div>
          ` : ''}
        </div>
        ` : ''}

        ${translation1 && translation2 ? '<div class="tt-sep"></div>' : ''}

        <!-- Translation 2 -->
        ${translation2 ? `
        <div class="tt-section" data-lang="${this.escapeHtml(translation2.lang)}">
          <div class="tt-section-header">
            <span class="tt-lang-badge tr2">${getLangLabel(translation2.lang)}</span>
            <div class="tt-actions">
              <button type="button" class="tt-btn copy-button" data-text="${this.escapeHtml(translation2.text)}" title="Copy translation" aria-label="Copy translation">
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1em;height:1em">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
                </svg>
              </button>
              ${renderDictButton(translation2.text, translation2.lang)}
              ${ttsEnabled ? `
              <button type="button" class="tt-btn tts-button" data-text="${this.escapeHtml(translation2.text)}" data-lang="${translation2.lang}" title="Play pronunciation" aria-label="Play pronunciation">
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:1.1em;height:1.1em">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              </button>
              ` : ''}
            </div>
          </div>
          <span class="tt-translation-text ${textBreakClass}">${this.escapeHtml(translation2.text)}</span>
          ${translation2.phonetics ? `
            <div class="phonetics-container ${phoneticsVisible ? '' : 'hidden'}" >
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
    const initialWidth = this.tooltipEl.getBoundingClientRect().width;
    if (initialWidth > 0) {
      this.tooltipEl.style.width = `${initialWidth}px`;
      const body = this.tooltipEl.querySelector<HTMLElement>('.tt-body');
      if (body) body.style.width = '100%';
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.tooltipEl!.classList.add('visible');
      });
    });
  }

  hide() {
    if (this.tooltipEl) {
      this.closeHanziBreakdown();
      this.stopHanziAnimations();
      this.tooltipEl.classList.remove('visible');
      this.tooltipEl.style.display = 'none';
    }
  }

  private showHanziChoices(section: Element, characters: string[]): void {
    this.stopHanziAnimations();
    this.tooltipEl?.querySelector('.tt-hanzi-strip')?.remove();
    const header = section.querySelector('.tt-section-header');
    const badge = header?.querySelector('.tt-lang-badge');
    if (!header || !badge) return;
    const strip = document.createElement('div');
    strip.className = 'tt-hanzi-strip';
    for (const character of characters) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tt-hanzi-button';
      button.setAttribute('aria-label', `Loop stroke order for ${character}`);
      button.setAttribute('aria-pressed', 'false');
      const fallback = document.createElement('span');
      fallback.className = 'tt-hanzi-fallback';
      fallback.textContent = character;
      button.appendChild(fallback);
      const drawing = document.createElement('span');
      drawing.className = 'tt-hanzi-drawing';
      button.appendChild(drawing);
      strip.appendChild(button);
      const writer = HanziWriter.create(drawing, character, {
        width: 56,
        height: 56,
        padding: 3,
        showCharacter: false,
        showOutline: false,
        strokeAnimationSpeed: this.hanziStrokeSpeed,
        delayBetweenStrokes: 100,
        delayBetweenLoops: 500,
        charDataLoader: (char) => this.loadHanziData(char),
        onLoadCharDataSuccess: () => { fallback.hidden = true; },
        onLoadCharDataError: () => {
          drawing.hidden = true;
          button.disabled = true;
          this.hanziWriters.delete(button);
        },
      });
      this.hanziWriters.set(button, writer);
      void writer.animateCharacter();
    }
    badge.after(strip);
  }

  private highlightReading(section: Element, selectedElement: Element, selection: Selection, lang: string): string[] {
    const phoneticElement = section.querySelector('.tt-phonetic');
    const textElement = section.querySelector('.tt-source-text, .tt-translation-text');
    if (!textElement || !phoneticElement || selection.rangeCount === 0) return [];
    const range = selection.getRangeAt(0);
    const before = range.cloneRange();
    before.selectNodeContents(selectedElement);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    const end = start + range.toString().length;
    const source = textElement.textContent ?? '';
    const phonetics = phoneticElement.textContent ?? '';
    type ReadingUnit = { text: { start: number; end: number }; phonetic: Array<{ start: number; end: number }> };
    const units: ReadingUnit[] = [];
    if (lang.startsWith('en')) {
      const words = [...source.matchAll(/[A-Za-z'-]+/g)];
      const groups: Array<{ start: number; end: number }> = [];
      let groupStart = 0;
      for (const group of phonetics.split(' · ')) {
        if (/^[A-Za-z'-]+/.test(group)) {
          const withoutPunctuation = group.replace(/[^\p{L}\p{M}]+$/gu, '');
          groups.push({ start: groupStart, end: groupStart + withoutPunctuation.length });
        }
        groupStart += group.length + 3;
      }
      words.forEach((word, index) => {
        if (groups[index]) units.push({
          text: { start: word.index, end: word.index + word[0].length },
          phonetic: [groups[index]],
        });
      });
    } else if (lang.startsWith('zh')) {
      const textGlyphs = [...source.matchAll(/\p{Script=Han}/gu)];
      let glyphIndex = 0;
      for (const match of phonetics.matchAll(/\p{Script=Han}+/gu)) {
        const run = [...match[0]];
        const runEnd = match.index + match[0].length;
        const nextSeparator = phonetics.indexOf(' · ', runEnd);
        const tail = phonetics.slice(runEnd, nextSeparator < 0 ? undefined : nextSeparator);
        const syllables = [...tail.matchAll(/\p{Script=Latin}+/gu)];
        run.forEach((glyph, localIndex) => {
          const textGlyph = textGlyphs[glyphIndex++];
          const syllable = syllables[localIndex];
          if (!textGlyph || !syllable || textGlyph[0] !== glyph) return;
          units.push({
            text: { start: textGlyph.index, end: textGlyph.index + glyph.length },
            phonetic: [
              { start: match.index + localIndex, end: match.index + localIndex + glyph.length },
              { start: runEnd + syllable.index, end: runEnd + syllable.index + syllable[0].length },
            ],
          });
        });
      }
    }
    const selectingPhonetics = selectedElement === phoneticElement;
    const overlaps = (part: { start: number; end: number }) => part.start < end && part.end > start;
    const focused = units.filter(unit => selectingPhonetics
      ? unit.phonetic.some(overlaps) : overlaps(unit.text));
    this.clearReadingFocus();
    if (focused.length) {
      this.markReadingRanges(textElement, focused.map(unit => unit.text));
      this.markReadingRanges(phoneticElement, focused.flatMap(unit => unit.phonetic));
    }
    this.restoreReadingSelection(selection, range, selectedElement, start, end);
    return lang.startsWith('zh')
      ? focused.map(unit => source.slice(unit.text.start, unit.text.end))
      : [];
  }

  private restoreReadingSelection(selection: Selection, range: Range, element: Element, start: number, end: number): void {
    const locate = (offset: number): { node: Text; offset: number } | null => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        if (offset <= node.length) return { node, offset };
        offset -= node.length;
      }
      return null;
    };
    const first = locate(start);
    const last = locate(end);
    if (!first || !last) return;
    range.setStart(first.node, first.offset);
    range.setEnd(last.node, last.offset);
    selection.removeAllRanges?.();
    selection.addRange?.(range);
  }

  private clearReadingFocus(): void {
    this.tooltipEl?.querySelectorAll('.tt-source-text, .tt-translation-text, .tt-phonetic')
      .forEach(element => {
        if (element.querySelector('.tt-reading-focus')) element.textContent = element.textContent;
      });
  }

  private markReadingRanges(element: Element, ranges: Array<{ start: number; end: number }>): void {
    const content = element.textContent ?? '';
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const { start, end } of ranges.sort((a, b) => a.start - b.start)) {
      fragment.appendChild(document.createTextNode(content.slice(cursor, start)));
      const strong = document.createElement('strong');
      strong.className = 'tt-reading-focus';
      strong.textContent = content.slice(start, end);
      fragment.appendChild(strong);
      cursor = end;
    }
    fragment.appendChild(document.createTextNode(content.slice(cursor)));
    element.replaceChildren(fragment);
  }

  private loadHanziData(character: string): Promise<CharacterJson> {
    let data = this.hanziDataCache.get(character);
    if (!data) {
      const codePoint = character.codePointAt(0)!.toString(16).toUpperCase();
      const url = chrome.runtime.getURL(`hanzi-data/${codePoint}.json`);
      data = fetch(url).then(response => {
        if (!response.ok) throw new Error(`No stroke data for ${character}`);
        return response.json() as Promise<CharacterJson>;
      });
      this.hanziDataCache.set(character, data);
      void data.catch(() => this.hanziDataCache.delete(character));
    }
    return data;
  }

  private stopHanziAnimations(): void {
    this.closeHanziBreakdown();
    const writers = [...this.hanziWriters.values()];
    this.hanziWriters.clear();
    for (const writer of writers) {
      try {
        void writer.showCharacter({ duration: 0 }).catch(() => {});
      } catch {
        // Hanzi Writer throws synchronously if its character data failed to load.
      }
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

  updateHanziStrokeSpeed(speed: number): void {
    if ([0.5, 1, 1.5, 2, 3].includes(speed)) this.hanziStrokeSpeed = speed;
  }

  updateHanziBreakdownSettings(enabled: boolean, language: 'vi' | 'en'): void {
    const languageChanged = this.hanziBreakdownLanguage !== language;
    this.hanziBreakdownEnabled = enabled;
    this.hanziBreakdownLanguage = language;
    if (!enabled) this.closeHanziBreakdown();
    else if (languageChanged && this.breakdownRoot && this.breakdownPath.length) {
      const path = [...this.breakdownPath];
      void this.showHanziBreakdown(path[path.length - 1], path);
    }
  }

  private async showHanziBreakdown(character: string, path: string[] = [character]): Promise<void> {
    const request = ++this.breakdownRequest;
    this.breakdownCharacter = path[0];
    this.breakdownPath = path;
    const root = this.ensureHanziBreakdownRoot();
    const shadow = root.shadowRoot!;
    shadow.querySelector('.hanzi-breakdown-card')?.remove();
    const loading = document.createElement('section');
    loading.className = 'hanzi-breakdown-card';
    const pendingClose = document.createElement('button');
    pendingClose.type = 'button';
    pendingClose.className = 'hanzi-breakdown-close';
    pendingClose.setAttribute('aria-label', this.hanziBreakdownLanguage === 'vi' ? 'Đóng phân rã' : 'Close breakdown');
    pendingClose.textContent = '×';
    pendingClose.addEventListener('click', () => this.closeHanziBreakdown());
    loading.append(pendingClose, document.createTextNode(`${character} · ${this.hanziBreakdownLanguage === 'vi' ? 'Đang tải' : 'Loading'}`));
    shadow.appendChild(loading);
    this.positionHanziBreakdown();
    try {
      const breakdown = await getHanziBreakdown(character);
      if (request !== this.breakdownRequest) return;
      const language = this.hanziBreakdownLanguage;
      const ownMeaning = breakdown.meaning && language === 'vi'
        ? await this.translateHanziMeaning(breakdown.meaning) : breakdown.meaning;
      const componentMeanings = await Promise.all(breakdown.components.map(async component => {
        if (!component.meaning || language === 'en') return component.meaning;
        return this.translateHanziMeaning(component.meaning);
      }));
      const memoryNote = await getHanziMemoryNote(character);
      const personalMeaning = await getPersonalHanziMeaning(character, language);
      const componentPersonalMeanings = await Promise.all(breakdown.components.map(component =>
        component.character === '？' ? '' : getPersonalHanziMeaning(component.character, language)));
      const unidentifiedPaths = breakdown.unidentifiedStrokeIndices.length
        ? await this.loadHanziData(character).then(data =>
          data.strokes.length === breakdown.strokeCount
            ? breakdown.unidentifiedStrokeIndices.map(index => data.strokes[index]).filter((path): path is string => !!path)
            : []).catch(() => [] as string[])
        : [];
      const unidentifiedExplanation = breakdown.components.some(component => component.character === '？')
        ? await getUnidentifiedStrokeExplanation(character) : '';
      if (request !== this.breakdownRequest) return;
      const labels = language === 'vi'
        ? { title: 'Phân rã chữ Hán', unknown: 'Chưa rõ cấu tạo', empty: 'Chưa có dữ liệu phân rã', meaning: 'Gợi nghĩa', sound: 'Gợi âm', radical: 'Bộ thủ tra cứu', back: 'Quay lại', close: 'Đóng phân rã' }
        : { title: 'Hanzi breakdown', unknown: 'Unknown component', empty: 'No component data', meaning: 'Meaning hint', sound: 'Sound hint', radical: 'Dictionary radical', back: 'Back', close: 'Close breakdown' };
      shadow.querySelector('.hanzi-breakdown-card')?.remove();
      const card = document.createElement('section');
      card.className = 'hanzi-breakdown-card';
      card.setAttribute('aria-label', labels.title);
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'hanzi-breakdown-close';
      close.setAttribute('aria-label', labels.close);
      close.textContent = '×';
      close.addEventListener('click', () => this.closeHanziBreakdown());
      card.appendChild(close);
      if (path.length > 1) {
        const parent = path[path.length - 2];
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'hanzi-breakdown-back';
        back.setAttribute('aria-label', language === 'vi' ? `${labels.back} ${parent}` : `${labels.back} to ${parent}`);
        back.textContent = `← ${labels.back}: ${parent}`;
        back.addEventListener('click', () => void this.showHanziBreakdown(parent, path.slice(0, -1)));
        card.appendChild(back);
      }
      const title = document.createElement('h2');
      title.textContent = `${breakdown.character} ${breakdown.pinyin.join(', ')}`;
      const heading = document.createElement('p');
      heading.className = 'hanzi-breakdown-heading';
      heading.textContent = labels.title;
      heading.addEventListener('mousedown', event => {
        if (event.button !== 0 || !this.breakdownRoot) return;
        event.preventDefault();
        this.breakdownPositionLocked = true;
        this.breakdownDragCleanup?.();
        const target = this.breakdownRoot;
        const bounds = target.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;
        const left = bounds.left;
        const top = bounds.top;
        target.style.right = 'auto';
        target.style.left = `${left}px`;
        const move = (moveEvent: MouseEvent) => {
          target.style.left = `${left + moveEvent.clientX - startX}px`;
          target.style.top = `${top + moveEvent.clientY - startY}px`;
        };
        const stop = () => this.breakdownDragCleanup?.();
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
        this.breakdownDragCleanup = () => {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', stop);
          this.breakdownDragCleanup = null;
        };
      });
      card.appendChild(heading);
      card.appendChild(title);
      card.appendChild(this.createHanziMeaningEditor(character, language, ownMeaning ?? labels.unknown, personalMeaning, true));
      if (!breakdown.components.length) {
        const empty = document.createElement('p');
        empty.textContent = labels.empty;
        card.appendChild(empty);
      }
      let unknownShown = false;
      for (const [index, component] of breakdown.components.entries()) {
        if (component.character === '？') {
          if (unknownShown) continue;
          unknownShown = true;
          const row = document.createElement('div');
          row.className = 'hanzi-breakdown-component hanzi-breakdown-unidentified';
          if (unidentifiedPaths.length) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 1024 1024');
            svg.setAttribute('aria-label', `${language === 'vi' ? 'Nét chưa xác định của' : 'Unidentified strokes for'} ${character}`);
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('transform', 'translate(0 900) scale(1 -1)');
            for (const pathData of unidentifiedPaths) {
              const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              path.setAttribute('d', pathData);
              group.appendChild(path);
            }
            svg.appendChild(group);
            row.appendChild(svg);
          }
          const label = document.createElement('span');
          label.textContent = unidentifiedExplanation || (language === 'vi' ? 'Chưa xác định' : 'Unidentified');
          const edit = document.createElement('button');
          edit.type = 'button';
          edit.className = 'hanzi-breakdown-meaning-action';
          edit.setAttribute('aria-label', `Edit unidentified strokes for ${character}`);
          edit.title = language === 'vi' ? 'Sửa phần chưa xác định' : 'Edit unidentified strokes';
          edit.innerHTML = EDIT_MEANING_SVG;
          const input = document.createElement('textarea');
          input.className = 'hanzi-breakdown-meaning-input';
          input.setAttribute('aria-label', `Explanation for unidentified strokes of ${character}`);
          input.value = unidentifiedExplanation;
          input.hidden = true;
          const status = document.createElement('span');
          status.className = 'hanzi-breakdown-save-status';
          status.setAttribute('role', 'status');
          edit.addEventListener('click', () => {
            input.hidden = !input.hidden;
            if (!input.hidden) input.focus();
          });
          input.addEventListener('input', () => {
            label.textContent = input.value || (language === 'vi' ? 'Chưa xác định' : 'Unidentified');
            status.textContent = language === 'vi' ? 'Đang lưu…' : 'Saving…';
            void saveUnidentifiedStrokeExplanation(character, input.value).then(() => {
              status.textContent = language === 'vi' ? 'Đã lưu' : 'Saved';
            }, () => {
              status.textContent = language === 'vi' ? 'Không lưu được' : 'Could not save';
            });
          });
          row.append(label, edit, input, status);
          card.appendChild(row);
          continue;
        }
        const row = document.createElement('div');
        row.className = 'hanzi-breakdown-component';
        const glyph = document.createElement(component.expandable ? 'button' : 'strong');
        glyph.textContent = component.character;
        if (component.expandable) {
          glyph.setAttribute('type', 'button');
          glyph.setAttribute('data-component', component.character);
          glyph.addEventListener('click', () => void this.showHanziBreakdown(component.character, [...path, component.character]));
        }
        const pronunciation = document.createElement('span');
        pronunciation.className = 'hanzi-breakdown-pinyin';
        pronunciation.textContent = component.pinyin.join(', ');
        const meaning = this.createHanziMeaningEditor(component.character, language,
          componentMeanings[index] ?? labels.unknown, componentPersonalMeanings[index], false);
        row.append(glyph, pronunciation, meaning);
        const tags: string[] = [];
        if (component.isRadical) tags.push(labels.radical);
        if (component.role === 'meaning') tags.push(labels.meaning);
        if (component.role === 'sound') tags.push(labels.sound);
        if (tags.length) {
          const annotation = document.createElement('small');
          annotation.textContent = tags.join(' · ');
          row.appendChild(annotation);
        }
        card.appendChild(row);
      }
      const noteLabel = document.createElement('label');
      noteLabel.className = 'hanzi-breakdown-note';
      noteLabel.textContent = language === 'vi' ? 'Ghi chú ghi nhớ' : 'Memory note';
      const noteInput = document.createElement('textarea');
      noteInput.setAttribute('aria-label', noteLabel.textContent);
      noteInput.rows = 3;
      noteInput.value = memoryNote;
      const noteStatus = document.createElement('span');
      noteStatus.className = 'hanzi-breakdown-save-status';
      noteStatus.setAttribute('role', 'status');
      noteInput.addEventListener('input', () => {
        noteStatus.textContent = language === 'vi' ? 'Đang lưu…' : 'Saving…';
        void saveHanziMemoryNote(character, noteInput.value).then(() => {
          noteStatus.textContent = language === 'vi' ? 'Đã lưu' : 'Saved';
        }, () => {
          noteStatus.textContent = language === 'vi' ? 'Không lưu được' : 'Could not save';
        });
      });
      noteLabel.append(noteInput, noteStatus);
      card.appendChild(noteLabel);
      shadow.appendChild(card);
      this.positionHanziBreakdown();
    } catch (error) {
      if (request === this.breakdownRequest) {
        const message = this.hanziBreakdownLanguage === 'vi' ? 'Không tải được dữ liệu phân rã' : 'Could not load breakdown data';
        loading.lastChild!.textContent = message;
        console.error('Failed to load Hanzi breakdown:', error);
      }
    }
  }

  private positionHanziBreakdown(): void {
    if (this.breakdownPositionLocked || !this.breakdownRoot || !this.tooltipEl) return;
    const anchor = this.tooltipEl.getBoundingClientRect();
    const card = this.breakdownRoot.getBoundingClientRect();
    if (!anchor.width || !card.width) return;
    const margin = 16;
    const gap = 12;
    const maxLeft = Math.max(margin, window.innerWidth - margin - card.width);
    const maxTop = Math.max(margin, window.innerHeight - margin - card.height);
    const clamp = (value: number, max: number) => Math.min(Math.max(value, margin), max);
    let left: number;
    let top = clamp(anchor.top, maxTop);
    if (anchor.right + gap + card.width <= window.innerWidth - margin) {
      left = anchor.right + gap;
    } else if (anchor.left - gap - card.width >= margin) {
      left = anchor.left - gap - card.width;
    } else if (anchor.bottom + gap + card.height <= window.innerHeight - margin) {
      left = clamp(anchor.left, maxLeft);
      top = anchor.bottom + gap;
    } else if (anchor.top - gap - card.height >= margin) {
      left = clamp(anchor.left, maxLeft);
      top = anchor.top - gap - card.height;
    } else {
      left = clamp(anchor.right + gap, maxLeft);
    }
    this.breakdownRoot.style.right = 'auto';
    this.breakdownRoot.style.left = `${left}px`;
    this.breakdownRoot.style.top = `${top}px`;
  }

  private createHanziMeaningEditor(
    character: string, language: 'vi' | 'en', original: string, initialPersonal: string, main: boolean,
  ): HTMLElement {
    const wrapper = document.createElement(main ? 'p' : 'span');
    if (main) wrapper.className = 'hanzi-breakdown-definition';
    else wrapper.className = 'hanzi-breakdown-component-meaning';
    const text = document.createElement('span');
    text.className = 'hanzi-breakdown-meaning-text';
    let personal = initialPersonal;
    let showPersonal = !!personal;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'hanzi-breakdown-meaning-action';
    edit.setAttribute('aria-label', `Edit meaning for ${character}`);
    edit.title = language === 'vi' ? 'Sửa nghĩa cá nhân' : 'Edit personal meaning';
    edit.innerHTML = EDIT_MEANING_SVG;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'hanzi-breakdown-meaning-action';
    toggle.innerHTML = SWITCH_MEANING_SVG;
    const input = document.createElement('textarea');
    input.setAttribute('aria-label', `Personal meaning for ${character}`);
    input.className = 'hanzi-breakdown-meaning-input';
    input.rows = 2;
    input.hidden = true;
    input.value = personal;
    const status = document.createElement('span');
    status.className = 'hanzi-breakdown-save-status';
    status.setAttribute('role', 'status');
    const refresh = () => {
      text.textContent = showPersonal && personal ? personal : original;
      toggle.hidden = !personal;
      toggle.title = showPersonal ? (language === 'vi' ? 'Xem nghĩa gốc' : 'Show original meaning')
        : (language === 'vi' ? 'Xem nghĩa cá nhân' : 'Show personal meaning');
      toggle.setAttribute('aria-label', `${showPersonal ? 'Show original meaning for' : 'Show personal meaning for'} ${character}`);
    };
    refresh();
    edit.addEventListener('click', () => {
      input.hidden = !input.hidden;
      if (!input.hidden) {
        input.value = personal || original;
        input.focus();
      }
    });
    toggle.addEventListener('click', () => {
      showPersonal = !showPersonal;
      refresh();
    });
    input.addEventListener('input', () => {
      personal = input.value;
      showPersonal = !!personal;
      refresh();
      status.textContent = language === 'vi' ? 'Đang lưu…' : 'Saving…';
      void savePersonalHanziMeaning(character, language, personal).then(() => {
        status.textContent = language === 'vi' ? 'Đã lưu' : 'Saved';
      }, () => {
        status.textContent = language === 'vi' ? 'Không lưu được' : 'Could not save';
      });
    });
    wrapper.append(text, edit, toggle, input, status);
    return wrapper;
  }

  private ensureHanziBreakdownRoot(): HTMLDivElement {
    if (this.breakdownRoot) return this.breakdownRoot;
    const root = document.createElement('div');
    root.id = 'translation-extension-hanzi-breakdown-root';
    root.style.position = 'fixed';
    root.style.top = '16px';
    root.style.right = '16px';
    root.style.zIndex = '2147483647';
    const shadow = root.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = BREAKDOWN_CSS;
    shadow.appendChild(style);
    document.body.appendChild(root);
    this.breakdownRoot = root;
    return root;
  }

  private closeHanziBreakdown(): void {
    this.breakdownDragCleanup?.();
    this.breakdownPositionLocked = false;
    this.breakdownRequest++;
    this.breakdownCharacter = null;
    this.breakdownPath = [];
    this.breakdownRoot?.remove();
    this.breakdownRoot = null;
  }

  private translateHanziMeaning(meaning: string): Promise<string> {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage({ type: 'TRANSLATE_HANZI_MEANING', meaning }, response => {
          resolve(response?.success && typeof response.meaning === 'string' ? response.meaning : meaning);
        });
      } catch {
        resolve(meaning);
      }
    });
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
