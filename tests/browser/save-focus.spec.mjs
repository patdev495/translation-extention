import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

let tooltipScript;

test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `
        import { TranslationTooltip } from './src/content/tooltip';
        window.chrome = {
          runtime: {
            getURL: path => '/assets/' + path,
            sendMessage(message, callback) {
              if (message.type === 'GET_ACCOUNT_LINK_STATUS') callback({ success: true, status: { state: 'linked' } });
              else if (message.type === 'LEARNING_FOLDERS') callback({ success: true, result: [{ id: 'folder', name: 'HSK', parent_id: null }] });
              else if (message.type === 'LEARNING_SUGGEST_MEANING') callback({ success: true, meaning: 'học' });
              else callback({ success: true });
            },
          },
          storage: { local: {
            get: async () => ({ defaultLearningFolder: 'folder' }),
            set: async () => {},
          } },
        };
        new TranslationTooltip().show(0, 0, '我喜欢学习。', { detectedLang: 'zh', translations: [] });
      `,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    loader: { '.css': 'text' },
  });
  tooltipScript = result.outputFiles[0].text;
});

test.beforeEach(async ({ page }) => {
  await page.route('http://tooltip.test/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<html><body><script src="/tooltip.js"></script></body></html>' });
    if (path === '/tooltip.js') return route.fulfill({ contentType: 'text/javascript', body: tooltipScript });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto('http://tooltip.test/');
});

for (const [category, key] of [['Word or Phrase', '1'], ['Sentence', '2']]) {
  test(`${category} saves with S after editing meaning and clicking the save heading`, async ({ page }) => {
    const tooltip = page.locator('#translation-extension-root #tooltip');
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('s');
    await page.keyboard.press(key);
    await expect(tooltip.locator('.tt-save-folder')).toHaveValue('folder');
    const meaning = tooltip.getByLabel('Nghĩa gợi ý');
    await meaning.fill('Tôi thích học');
    await page.keyboard.press('s');
    await expect(meaning).toHaveValue('Tôi thích họcs');
    await expect(tooltip.locator('.tt-save-success')).toHaveCount(0);
    await meaning.fill('Tôi thích học.');
    await tooltip.locator('.tt-save-title').click();
    await expect(meaning).not.toBeFocused();
    await page.keyboard.press('s');
    await expect(tooltip.locator('.tt-save-success')).toContainText('Đã lưu');
  });
}

test('Both saves with S after editing each meaning and clicking outside the sentence meaning', async ({ page }) => {
  const tooltip = page.locator('#translation-extension-root #tooltip');
  const source = tooltip.locator('.tt-source-text');
  await source.evaluate(element => {
    const range = document.createRange();
    range.setStart(element.firstChild, 3);
    range.setEnd(element.firstChild, 5);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await source.dispatchEvent('mouseup');
  await page.keyboard.press('s');
  await page.keyboard.press('3');
  await expect(tooltip.locator('.tt-save-folder')).toHaveValue('folder');
  const wordMeaning = tooltip.getByLabel('Nghĩa gợi ý');
  const sentenceMeaning = tooltip.getByLabel('Nghĩa câu', { exact: true });
  await wordMeaning.fill('học tập');
  await sentenceMeaning.fill('Tôi thích học');
  await page.keyboard.press('s');
  await expect(sentenceMeaning).toHaveValue('Tôi thích họcs');
  await expect(tooltip.locator('.tt-save-success')).toHaveCount(0);
  await sentenceMeaning.fill('Tôi thích học.');
  await tooltip.locator('.tt-save-title').click();
  await expect(sentenceMeaning).not.toBeFocused();
  await expect(wordMeaning).toHaveValue('học tập');
  await expect(sentenceMeaning).toHaveValue('Tôi thích học.');
  await page.keyboard.press('s');
  await expect(tooltip.locator('.tt-save-success')).toContainText('Đã lưu');
});
