import { TranslationTooltip } from '../src/content/tooltip';
import { initPinnedSnippetsSync } from '../src/content/pinned-panel';
import { OcrSelectionOverlay } from '../src/content/ocr-selection-overlay';
import { createInputReplacementAdapter } from '../src/content/input-replacement-dom';

const state = new URLSearchParams(location.search).get('state') || 'tooltip';
const source = 'Read in another language.';
const tooltip = new TranslationTooltip();

if (state === 'tooltip' || state === 'long') {
  tooltip.updateFontSize('16');
  tooltip.show(0, 0, state === 'long' ? source.repeat(30) : source, {
    detectedLang: 'en',
    sourcePhonetics: '/riːd ɪn əˈnʌðər ˈlæŋɡwɪdʒ/',
    translations: [
      { lang: 'vi', text: 'Đọc bằng một ngôn ngữ khác.' },
      { lang: 'zh', text: '用另一种语言阅读。', phonetics: 'Yòng lìng yī zhǒng yǔyán yuèdú.' },
    ],
  });
} else if (state === 'ocr') {
  const overlay = new OcrSelectionOverlay(document.body, {
    shadowMode: true,
    onSelectionComplete: () => {},
  });
  overlay.start();
  overlay.showProgress('Recognizing text…', { left: 40, top: 160 });
} else if (state === 'pinned') {
  const canvas = document.createElement('canvas');
  canvas.width = 440;
  canvas.height = 100;
  const context = canvas.getContext('2d')!;
  const tokens = getComputedStyle(document.documentElement);
  context.fillStyle = tokens.getPropertyValue('--color-cotton').trim();
  context.fillRect(0, 0, 440, 100);
  context.fillStyle = tokens.getPropertyValue('--color-ink').trim();
  context.font = '20px ' + tokens.getPropertyValue('--font-body').trim();
  context.fillText(source, 24, 56);
  await chrome.storage.local.set({
    settings: { ocrPinImage: true },
    pinned_snippets: [{ id: 'preview', imageUrl: canvas.toDataURL(), x: 24, y: 80, width: 440, height: 100 }],
  });
  initPinnedSnippetsSync();
} else if (state === 'input' || state === 'input-error') {
  const textarea = document.createElement('textarea');
  textarea.setAttribute('aria-label', 'Editable Field');
  textarea.value = source;
  textarea.style.cssText = 'margin:24px;width:calc(100% - 48px);height:120px';
  document.body.appendChild(textarea);
  textarea.focus();
  const status = createInputReplacementAdapter().showStatus({
    text: source, isCurrent: () => true, replace: () => {},
  });
  if (state === 'input-error') status.error('Dịch thất bại.');
}
