import { test, expect, chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let server, crossServer, origin, crossOrigin, context, worker, profile;

function samplePdf() {
  const stream = 'BT /F1 36 Tf 80 650 Td (HELLO WORLD) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i+1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

test.beforeAll(async () => {
  const handler = (req, res) => {
    if (req.url === '/sample.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Access-Control-Allow-Origin', '*'); res.end(samplePdf()); return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (req.url === '/ocr-smoke') res.end('<html><body style="margin:0;background:white"><p style="position:absolute;left:300px;top:230px;font:48px Arial;color:black">HELLO WORLD</p></body></html>');
    else if (req.url === '/scroll') res.end('<html><body style="margin:0;height:2000px;background:white"><div style="position:absolute;top:600px;left:300px;width:200px;height:100px;background:rgb(0,128,0)"></div></body></html>');
    else if (['/frames', '/cross', '/nested'].includes(req.url)) res.end(`<html><head><title>Frames</title></head><frameset frameborder="0" rows="98,*"><frame name="Up" src="/header"><frameset cols="18%,82%" frameborder="0"><frame name="leftBottom" src="${req.url === '/cross' ? crossOrigin : ''}${req.url === '/nested' ? '/container' : '/left'}"><frame name="NotesView" src="/right"></frameset></frameset></html>`);
    else if (req.url === '/container') res.end('<iframe name="leaf" src="/left" style="width:100%;height:80%;border:0"></iframe>');
    else if (['/iframes', '/blank'].includes(req.url)) {
      const child = req.url === '/blank'
        ? 'srcdoc="&lt;p id=source&gt;查询已发行文件&lt;/p&gt;&lt;button id=site onclick=&quot;this.textContent=\'Clicked\'&quot;&gt;Site control&lt;/button&gt;"'
        : 'src="/left"';
      res.end(`<html><body><iframe name="leftBottom" ${child} style="position:absolute;left:0;top:98px;width:216px;height:600px;border:0"></iframe><iframe name="NotesView" src="/right" style="position:absolute;left:216px;top:98px;width:984px;height:600px;border:0"></iframe></body></html>`);
    }
    else res.end(`<html><body style="margin:0; background:${req.url === '/right' ? '#ccc' : '#fff'}"><p id="source">查询已发行文件</p><button id="site" onclick="this.textContent='Clicked'">Site control</button></body></html>`);
  };
  server = createServer(handler);
  crossServer = createServer(handler);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  await new Promise(r => crossServer.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}`;
  crossOrigin = `http://127.0.0.1:${crossServer.address().port}`;
  profile = await mkdtemp(join(tmpdir(), 'polytranslate-frames-'));
  const extension = resolve('dist');
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 1200, height: 800 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
      '--host-resolver-rules=MAP workflow.test 127.0.0.1', '--no-proxy-server'],
  });
  worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate(async () => {
    await chrome.storage.local.set({ privacyConsentGranted: true, active: true, settings: {
      provider: 'google', primaryTargetLang: 'vi', secondaryTargetLang: 'none',
      reverseTargetLang: 'none', ttsEnabled: false, ocrCopyToClipboard: false,
    }});
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      if (!String(input).startsWith('https://translate.googleapis.com/')) return realFetch(input, init);
      if (globalThis.holdTranslation) await new Promise(resolve => { globalThis.releaseTranslation = resolve; });
      return new Response(JSON.stringify([[['Tra cứu văn bản', '查询已发行文件']], null, 'zh']));
    };
    const send = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = async (...args) => {
      if (args[0]?.type === 'RUN_OCR' && !globalThis.realOcr) {
        globalThis.capturedRegion = args[0].dataUrl;
        globalThis.ocrJobId = args[0].jobId;
        if (globalThis.holdOcr) await new Promise(resolve => { globalThis.releaseOcr = resolve; });
        return { success: true, text: '查询已发行文件' };
      }
      return send(...args);
    };
  });
  console.log('Browser:', context.browser()?.version());
});

test.beforeEach(async () => {
  await worker.evaluate(async () => {
    globalThis.holdOcr = false; globalThis.holdTranslation = false;
    globalThis.realOcr = false;
    await chrome.storage.local.set({ pinned_snippets: [], settings: {
      provider: 'google', primaryTargetLang: 'vi', secondaryTargetLang: 'none', reverseTargetLang: 'none',
      ttsEnabled: false, ocrCopyToClipboard: false, ocrPinImage: false,
    }});
  });
});

test.afterEach(async () => {
  await worker.evaluate(() => {
    globalThis.holdOcr = false; globalThis.holdTranslation = false;
    globalThis.releaseOcr?.(); globalThis.releaseTranslation?.();
    globalThis.releaseCapture?.();
    if (globalThis.originalCapture) {
      chrome.tabs.captureVisibleTab = globalThis.originalCapture;
      globalThis.originalCapture = null;
    }
  }).catch(() => {});
});
test.afterAll(async () => {
  test.setTimeout(120000);
  await context?.close();
  server?.closeAllConnections();
  crossServer?.closeAllConnections();
  await new Promise(r => server?.close(r));
  await new Promise(r => crossServer?.close(r));
  if (profile) await rm(profile, { recursive: true, force: true });
});

for (const fixture of ['/cross', '/nested', '/iframes', '/blank']) {
  test(`Translation Tooltip works from ${fixture} child documents`, async () => {
    const page = await context.newPage(); await page.goto(`${origin}${fixture}`);
    const child = page.frame({ name: fixture === '/nested' ? 'leaf' : 'leftBottom' });
    await child.locator('#source').selectText();
    await child.locator('#source').dispatchEvent('mouseup', { bubbles: true });
    const tooltip = page.locator('#translation-extension-root #tooltip');
    await expect(tooltip).toBeVisible();
    await tooltip.getByRole('button', { name: 'Toggle phonetics (IPA/Pinyin)' }).click();
    await page.frame({ name: 'NotesView' }).locator('#site').click();
    await expect(tooltip).toBeHidden();
    await page.close();
  });
}

test('selection in the left frame opens one clickable Translation Tooltip over the content frame', async () => {
  const page = await context.newPage();
  await page.goto(`${origin}/frames`);
  const left = page.frame({ name: 'leftBottom' });
  await left.locator('#source').selectText();
  await left.locator('#source').dispatchEvent('mouseup', { bubbles: true });
  const tooltip = page.locator('#translation-extension-root #tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Tra cứu văn bản');
  const box = await tooltip.boundingBox();
  expect(box.x).toBeGreaterThan(216);
  await tooltip.getByRole('button', { name: 'Toggle phonetics (IPA/Pinyin)' }).click();
  const dragBox = await tooltip.boundingBox();
  await page.mouse.move(dragBox.x + 8, dragBox.y + 8); await page.mouse.down();
  await page.mouse.move(dragBox.x + 8, 38, { steps: 5 }); await page.mouse.up();
  expect((await tooltip.boundingBox()).y).toBeLessThan(98);
  await tooltip.getByRole('button', { name: 'Toggle phonetics (IPA/Pinyin)' }).click();
  await page.screenshot({ path: test.info().outputPath('frameset-tooltip.png') });
  await page.frame({ name: 'NotesView' }).locator('#site').click();
  await expect(page.frame({ name: 'NotesView' }).locator('#site')).toHaveText('Clicked');
  await expect(tooltip).toBeHidden();
  await page.close();
});

test('OCR started in a child frame selects across frames and captures the intended pixels', async () => {
  const page = await context.newPage();
  await page.goto(`${origin}/frames`);
  await page.frame({ name: 'leftBottom' }).locator('#site').focus();
  await page.keyboard.press('Control+Space');
  await expect(page.locator('#polytranslate-ocr-overlay-root .overlay')).toBeVisible();
  await page.mouse.move(100, 300);
  await page.mouse.down();
  await page.mouse.move(600, 400, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#translation-extension-root #tooltip')).toBeVisible();
  const dataUrl = await worker.evaluate(() => globalThis.capturedRegion);
  const crop = await page.evaluate(async url => {
    const img = new Image(); img.src = url; await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
    return { width: img.width, height: img.height,
      left: [...ctx.getImageData(10, 10, 1, 1).data],
      right: [...ctx.getImageData(img.width - 10, 10, 1, 1).data] };
  }, dataUrl);
  expect(crop).toEqual({ width: 500, height: 100, left: [255,255,255,255], right: [204,204,204,255] });
  await page.close();
});

test('a cancelled OCR result cannot reopen a tooltip or close a newer OCR selection', async () => {
  await worker.evaluate(() => { globalThis.holdOcr = true; globalThis.releaseOcr = null; });
  const page = await context.newPage();
  await page.goto(`${origin}/frames`);
  await page.frame({ name: 'leftBottom' }).locator('#site').focus();
  await page.keyboard.press('Control+Space');
  const overlay = page.locator('#polytranslate-ocr-overlay-root .overlay');
  await expect(overlay).toBeVisible();
  await page.mouse.move(100, 300); await page.mouse.down();
  await page.mouse.move(600, 400); await page.mouse.up();
  await expect.poll(() => worker.evaluate(() => typeof globalThis.releaseOcr)).toBe('function');
  await page.keyboard.press('Escape');
  await expect(page.locator('#polytranslate-ocr-overlay-root')).toHaveCount(0);
  await page.keyboard.press('Control+Space');
  await expect(overlay).toBeVisible();
  await worker.evaluate(() => { globalThis.holdOcr = false; globalThis.releaseOcr(); });
  // Allow the deliberately delayed external OCR response to reach the UI.
  await page.waitForTimeout(300);
  await expect(overlay).toBeVisible();
  await expect(page.locator('#translation-extension-root #tooltip')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.close();
});

test('starting OCR hides the existing Translation Tooltip before selecting an Image Region', async () => {
  const page = await context.newPage();
  await page.goto(`${origin}/frames`);
  const left = page.frame({ name: 'leftBottom' });
  await left.locator('#source').selectText();
  await left.locator('#source').dispatchEvent('mouseup', { bubbles: true });
  const tooltip = page.locator('#translation-extension-root #tooltip');
  await expect(tooltip).toBeVisible();
  await left.locator('#site').focus();
  await page.keyboard.press('Control+Space');
  await expect(page.locator('#polytranslate-ocr-overlay-root .overlay')).toBeVisible();
  await expect(tooltip).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#polytranslate-ocr-overlay-root')).toHaveCount(0);
  await page.close();
});

test('clicking another frame dismisses a translation that has not returned yet', async () => {
  await worker.evaluate(() => { globalThis.holdTranslation = true; globalThis.releaseTranslation = null; });
  const page = await context.newPage();
  await page.goto(`${origin}/frames`);
  const left = page.frame({ name: 'leftBottom' });
  await left.locator('#source').selectText();
  await left.locator('#source').dispatchEvent('mouseup', { bubbles: true });
  await expect.poll(() => worker.evaluate(() => typeof globalThis.releaseTranslation)).toBe('function');
  await page.frame({ name: 'NotesView' }).locator('#site').click();
  await worker.evaluate(() => { globalThis.holdTranslation = false; globalThis.releaseTranslation(); });
  await page.waitForTimeout(300);
  await expect(page.locator('#translation-extension-root #tooltip')).toBeHidden();
  await page.close();
});

test('a synced Pinned Snippet Panel appears once over a frameset and can be removed', async () => {
  const page = await context.newPage();
  const imageUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(0,0,80,80);
    return canvas.toDataURL();
  });
  await worker.evaluate(async imageUrl => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...settings, ocrPinImage: true }, pinned_snippets: [
      { id: 'fixture-pin', imageUrl, x: 400, y: 300, width: 80, height: 80 },
    ] });
  }, imageUrl);
  await page.goto(`${origin}/frames`);
  await expect(page.getByRole('button', { name: 'Remove pinned image' })).toBeVisible();
  for (const frame of page.frames().filter(f => f.parentFrame())) {
    await expect(frame.locator('.polytranslate-pinned-wrapper')).toHaveCount(0);
  }
  const handle = await page.getByText('Pinned image', { exact: true }).boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, 40, { steps: 5 }); await page.mouse.up();
  expect((await page.locator('.polytranslate-pinned-wrapper').boundingBox()).y).toBeLessThan(98);
  await page.getByRole('button', { name: 'Remove pinned image' }).click();
  await expect(page.locator('.polytranslate-pinned-wrapper')).toHaveCount(0);
  await page.close();
});

test('OCR captures page pixels underneath a pinned image and restores the panel afterwards', async () => {
  const page = await context.newPage();
  const imageUrl = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 80; c.height = 80;
    const ctx = c.getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(0,0,80,80);
    return c.toDataURL();
  });
  await worker.evaluate(async imageUrl => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...settings, ocrPinImage: true }, pinned_snippets: [
      { id: 'capture-pin', imageUrl, x: 400, y: 300, width: 80, height: 80 },
    ] });
  }, imageUrl);
  await page.goto(`${origin}/frames`);
  await expect(page.getByRole('button', { name: 'Remove pinned image' })).toBeVisible();
  await page.frame({ name: 'leftBottom' }).locator('#site').focus();
  await page.keyboard.press('Control+Space');
  await expect(page.locator('#polytranslate-ocr-overlay-root .overlay')).toBeVisible();
  await page.mouse.move(300,250); await page.mouse.down();
  await page.mouse.move(700,500); await page.mouse.up();
  await expect(page.locator('#translation-extension-root #tooltip')).toBeVisible();
  const dataUrl = await worker.evaluate(() => globalThis.capturedRegion);
  const pixel = await page.evaluate(async url => {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img,0,0);
    return [...ctx.getImageData(140,110,1,1).data];
  }, dataUrl);
  expect(pixel).toEqual([204,204,204,255]);
  await expect(page.locator('.polytranslate-pinned-wrapper').first()).toBeVisible();
  await page.close();
});

test('OCR progress stays visible in its originating tab while recognition is pending', async () => {
  await worker.evaluate(() => { globalThis.holdOcr = true; globalThis.releaseOcr = null; });
  const page = await context.newPage(); await page.goto(`${origin}/frames`);
  await page.frame({ name: 'leftBottom' }).locator('#site').focus();
  await page.keyboard.press('Control+Space');
  await expect(page.locator('#polytranslate-ocr-overlay-root .overlay')).toBeVisible();
  await page.mouse.move(100,300); await page.mouse.down();
  await page.mouse.move(600,400); await page.mouse.up();
  await expect.poll(() => worker.evaluate(() => typeof globalThis.releaseOcr)).toBe('function');
  const other = await context.newPage(); await other.goto(`${origin}/right`);
  await expect(page.locator('.ocr-progress-indicator')).toBeVisible();
  const progressSender = await context.newPage();
  await progressSender.goto(worker.url().replace('service-worker.js', 'offscreen.html'));
  const jobId = await worker.evaluate(() => globalThis.ocrJobId);
  await progressSender.evaluate(jobId => chrome.runtime.sendMessage({
    type: 'OCR_PROGRESS', jobId, progress: { stage: 'recognizing', message: 'Reading fixture' },
  }), jobId);
  await expect(page.locator('.ocr-progress-indicator')).toContainText('Reading fixture');
  await expect(other.locator('.ocr-progress-indicator')).toHaveCount(0);
  await worker.evaluate(() => { globalThis.holdOcr = false; globalThis.releaseOcr(); });
  await expect(page.locator('#translation-extension-root #tooltip')).toBeVisible();
  await expect(other.locator('#translation-extension-root #tooltip')).toBeHidden();
  await progressSender.close(); await other.close(); await page.close();
});

test('the PDF viewer still renders pages and supports starting and cancelling OCR Selection Mode', async () => {
  const page = await context.newPage();
  await page.goto(`${worker.url().replace('service-worker.js', 'pdf-viewer/viewer.html')}?file=${encodeURIComponent(`${origin}/sample.pdf`)}`);
  await expect(page.locator('.page-wrapper canvas')).toBeVisible();
  await page.keyboard.press('Control+Space');
  await expect(page.locator('#btn-ocr-region')).toHaveAttribute('aria-pressed', 'true');
  const canvas = await page.locator('.page-wrapper canvas').boundingBox();
  await page.mouse.move(canvas.x + 30, canvas.y + 30); await page.mouse.down();
  await page.mouse.move(canvas.x + 180, canvas.y + 100);
  await expect(page.locator('.ocr-selection-box')).toBeVisible();
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(page.locator('.ocr-selection-box')).toHaveCount(0);
  await expect(page.locator('#btn-ocr-region')).toHaveAttribute('aria-pressed', 'false');
  await page.close();
});

test('translation and OCR cancellation still work on an ordinary webpage', async () => {
  const page = await context.newPage(); await page.goto(`${origin}/left`);
  await page.locator('#source').selectText();
  await page.locator('#source').dispatchEvent('mouseup', { bubbles: true });
  await expect(page.locator('#translation-extension-root #tooltip')).toBeVisible();
  await page.locator('#site').click();
  await page.keyboard.press('Control+Space');
  await expect(page.locator('#polytranslate-ocr-overlay-root .overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#polytranslate-ocr-overlay-root')).toHaveCount(0);
  await page.locator('#site').click(); await expect(page.locator('#site')).toHaveText('Clicked');
  await page.close();
});

test('a translation from a navigated child document is discarded', async () => {
  await worker.evaluate(() => { globalThis.holdTranslation = true; globalThis.releaseTranslation = null; });
  const page = await context.newPage(); await page.goto(`${origin}/cross`);
  const child = page.frame({ name: 'leftBottom' });
  await child.locator('#source').selectText();
  await child.locator('#source').dispatchEvent('mouseup', { bubbles: true });
  await expect.poll(() => worker.evaluate(() => typeof globalThis.releaseTranslation)).toBe('function');
  await child.goto(`${crossOrigin}/right`);
  await worker.evaluate(() => { globalThis.holdTranslation = false; globalThis.releaseTranslation(); });
  await page.waitForTimeout(300);
  await expect(page.locator('#translation-extension-root #tooltip')).toBeHidden();
  await page.close();
});

test('a newly synced pinned image cannot cover Translation Tooltip controls', async () => {
  const page = await context.newPage(); await page.goto(`${origin}/frames`);
  const left = page.frame({ name: 'leftBottom' });
  await left.locator('#source').selectText();
  await left.locator('#source').dispatchEvent('mouseup', { bubbles: true });
  const toggle = page.getByRole('button', { name: 'Toggle phonetics (IPA/Pinyin)' });
  await expect(toggle).toBeVisible();
  const box = await toggle.boundingBox();
  const imageUrl = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 150; c.height = 150; return c.toDataURL();
  });
  await worker.evaluate(async ({ imageUrl, x, y }) => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...settings, ocrPinImage: true }, pinned_snippets: [
      { id: 'late-pin', imageUrl, x, y, width: 150, height: 150 },
    ] });
  }, { imageUrl, x: box.x - 10, y: box.y - 10 });
  await expect(page.getByRole('button', { name: 'Remove pinned image' })).toBeVisible();
  await toggle.click({ timeout: 2500 });
  await expect(page.locator('.phonetics-container')).toHaveClass(/hidden/);
  await page.close();
});

test('changing the active tab during capture shows an error and never sends the wrong image to OCR', async () => {
  await worker.evaluate(() => {
    globalThis.capturedRegion = null; globalThis.releaseCapture = null;
    const capture = chrome.tabs.captureVisibleTab.bind(chrome.tabs);
    globalThis.originalCapture = capture;
    chrome.tabs.captureVisibleTab = async (...args) => {
      await new Promise(resolve => { globalThis.releaseCapture = resolve; });
      return capture(...args);
    };
  });
  const page = await context.newPage(); await page.goto(`${origin}/frames`);
  await page.frame({ name: 'leftBottom' }).locator('#site').focus();
  await page.keyboard.press('Control+Space');
  await expect(page.locator('#polytranslate-ocr-overlay-root .overlay')).toBeVisible();
  await page.mouse.move(100,300); await page.mouse.down();
  await page.mouse.move(600,400); await page.mouse.up();
  await expect.poll(() => worker.evaluate(() => typeof globalThis.releaseCapture)).toBe('function');
  const other = await context.newPage(); await other.goto(`${origin}/right`);
  await worker.evaluate(() => globalThis.releaseCapture());
  await expect(page.locator('.ocr-progress-indicator')).toContainText('changed during capture');
  await expect(page.locator('.ocr-progress-indicator')).toBeVisible();
  expect(await worker.evaluate(() => globalThis.capturedRegion)).toBeNull();
  await expect(page.locator('#translation-extension-root #tooltip')).toBeHidden();
  await other.close(); await page.close();
});

test('real model OCR smoke: a captured webpage region reaches the Translation Tooltip', async () => {
  test.skip(process.env.RUN_REAL_OCR !== '1', 'Opt in to loading the packaged OCR model with RUN_REAL_OCR=1');
  test.setTimeout(150000);
  await worker.evaluate(async () => {
    globalThis.realOcr = true;
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...settings, ocrModelTier: 'tiny', ocrLanguage: 'ch' } });
  });
  const page = await context.newPage(); await page.goto(`${origin}/ocr-smoke`);
  await page.keyboard.press('Control+Space');
  await expect(page.locator('#polytranslate-ocr-overlay-root .overlay')).toBeVisible();
  await page.mouse.move(280,260); await page.mouse.down();
  await page.mouse.move(800,360); await page.mouse.up();
  await expect(page.locator('#translation-extension-root .tt-source-text')).toContainText(/HELLO\s*WORLD/i, { timeout: 120000 });
  await page.close();
});

test('OCR Selection Mode also starts on an insecure HTTP intranet page', async () => {
  const page = await context.newPage();
  await page.goto(`${origin.replace('127.0.0.1', 'workflow.test')}/frames`);
  expect(await page.evaluate(() => isSecureContext)).toBe(false);
  await page.frame({ name: 'leftBottom' }).locator('#site').focus();
  await page.keyboard.press('Control+Space');
  await expect(page.locator('#polytranslate-ocr-overlay-root .overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#polytranslate-ocr-overlay-root')).toHaveCount(0);
  await page.close();
});

test('OCR crops the same Image Region after scrolling and resizing at device scale 2', async () => {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 700, deviceScaleFactor: 2, mobile: false });
  await page.goto(`${origin}/scroll`);
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
  await page.evaluate(() => window.scrollTo(0,400));
  await page.keyboard.press('Control+Space');
  await expect(page.locator('#polytranslate-ocr-overlay-root .overlay')).toBeVisible();
  await page.mouse.move(300,200); await page.mouse.down();
  await page.mouse.move(500,300); await page.mouse.up();
  await expect(page.locator('#translation-extension-root #tooltip')).toBeVisible();
  const dataUrl = await worker.evaluate(() => globalThis.capturedRegion);
  const crop = await page.evaluate(async url => {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img,0,0);
    // captureVisibleTab may retain native screenshot resolution under CDP DPR
    // emulation. Verify the fixture's pixels rather than assuming a PNG scale.
    return [[...ctx.getImageData(10,10,1,1).data], [...ctx.getImageData(img.width - 10,img.height - 10,1,1).data]];
  }, dataUrl);
  expect(crop).toEqual([[0,128,0,255], [0,128,0,255]]);
  await page.close();
});

test('the Hanzi Breakdown Tooltip opens and remains interactive over frames', async () => {
  await worker.evaluate(async () => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...settings, hanziBreakdownEnabled: true } });
  });
  const page = await context.newPage(); await page.goto(`${origin}/frames`);
  const left = page.frame({ name: 'leftBottom' });
  await left.locator('#source').selectText();
  await left.locator('#source').dispatchEvent('mouseup', { bubbles: true });
  const source = page.locator('#translation-extension-root .tt-source-text');
  await source.selectText(); await source.dispatchEvent('mouseup', { bubbles: true, composed: true });
  await page.getByRole('button', { name: 'Loop stroke order for 查', exact: true }).click();
  const heading = page.locator('.hanzi-breakdown-heading');
  await expect(heading).toBeVisible();
  const handle = await heading.boundingBox();
  await page.mouse.move(handle.x + 10, handle.y + 10); await page.mouse.down();
  await page.mouse.move(handle.x + 10, 40, { steps: 5 }); await page.mouse.up();
  expect((await heading.boundingBox()).y).toBeLessThan(98);
  await page.getByRole('button', { name: 'Đóng phân rã', exact: true }).click();
  await expect(heading).toHaveCount(0);
  await page.close();
});
