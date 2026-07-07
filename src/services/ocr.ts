import * as ort from 'onnxruntime-web';

export type OcrProgressStage = 'downloading' | 'loading' | 'recognizing';

export interface OcrProgress {
  stage: OcrProgressStage;
  message: string;
}

type ProgressHandler = (progress: OcrProgress) => void;

type ModelUrls = {
  detection: string;
  recognition: string;
  charactersDictionary: string;
};

type PaddleOcrServiceCtor = new (options?: unknown) => {
  initialize(): Promise<void>;
  recognize(image: HTMLCanvasElement, options?: { flatten?: false; strategy?: 'per-box' | 'per-line' | 'cross-line' }): Promise<{ text: string }>;
};

const DB_NAME = 'polytranslate-ocr-cache';
const DB_VERSION = 1;
const STORE_NAME = 'model-files';

const services = new Map<string, Promise<InstanceType<PaddleOcrServiceCtor>>>();

function openModelDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open OCR model cache.'));
  });
}

async function getCachedModelFile(key: string): Promise<ArrayBuffer | null> {
  const db = await openModelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error(`Could not read cached OCR model file: ${key}`));
    tx.oncomplete = () => db.close();
  });
}

async function setCachedModelFile(key: string, value: ArrayBuffer): Promise<void> {
  const db = await openModelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Could not cache OCR model file: ${key}`));
    tx.oncomplete = () => db.close();
  });
}

async function loadModelFile(url: string, label: string, onProgress?: ProgressHandler): Promise<ArrayBuffer> {
  const isLocal = url.startsWith('chrome-extension://') || !url.startsWith('http');
  if (!isLocal) {
    const cached = await getCachedModelFile(url);
    if (cached) return cached;
  }

  onProgress?.({ stage: 'downloading', message: `Loading OCR ${label}...` });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download OCR ${label}: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  if (!isLocal) {
    await setCachedModelFile(url, buffer);
  }
  return buffer;
}

async function loadCachedModel(urls: ModelUrls, onProgress?: ProgressHandler): Promise<ModelUrls | Record<keyof ModelUrls, ArrayBuffer>> {
  const [detection, recognition, charactersDictionary] = await Promise.all([
    loadModelFile(urls.detection, 'detector', onProgress),
    loadModelFile(urls.recognition, 'recognizer', onProgress),
    loadModelFile(urls.charactersDictionary, 'dictionary', onProgress),
  ]);

  return { detection, recognition, charactersDictionary };
}

async function createService(
  tier: 'tiny' | 'small' | 'medium',
  language: 'ch' | 'latin' = 'ch',
  onProgress?: ProgressHandler
): Promise<InstanceType<PaddleOcrServiceCtor>> {
  ort.env.wasm.wasmPaths = chrome.runtime.getURL('onnxruntime-web/');

  const ocrModule = await import('ppu-paddle-ocr/web');
  const PaddleOcrService = ocrModule.PaddleOcrService as PaddleOcrServiceCtor;

  let modelPreset: ModelUrls;
  if (language === 'latin') {
    modelPreset = {
      detection: chrome.runtime.getURL('models/PP-OCRv5_latin_det.onnx'),
      recognition: chrome.runtime.getURL('models/PP-OCRv5_latin_rec.onnx'),
      charactersDictionary: chrome.runtime.getURL('models/ppocrv5_latin_dict.txt'),
    };
  } else {
    if (tier === 'tiny') {
      modelPreset = {
        detection: chrome.runtime.getURL('models/PP-OCRv6_tiny_det.ort'),
        recognition: chrome.runtime.getURL('models/PP-OCRv6_tiny_rec.ort'),
        charactersDictionary: chrome.runtime.getURL('models/ppocrv6_tiny_dict.txt'),
      };
    } else if (tier === 'medium') {
      modelPreset = {
        detection: chrome.runtime.getURL('models/PP-OCRv6_medium_det.ort'),
        recognition: chrome.runtime.getURL('models/PP-OCRv6_medium_rec.ort'),
        charactersDictionary: chrome.runtime.getURL('models/ppocrv6_dict.txt'),
      };
    } else {
      modelPreset = {
        detection: chrome.runtime.getURL('models/PP-OCRv6_small_det.ort'),
        recognition: chrome.runtime.getURL('models/PP-OCRv6_small_rec.ort'),
        charactersDictionary: chrome.runtime.getURL('models/ppocrv6_dict.txt'),
      };
    }
  }

  const model = await loadCachedModel(modelPreset, onProgress);
  onProgress?.({ stage: 'loading', message: 'Loading OCR model...' });

  const service = new PaddleOcrService({
    model,
    recognition: { strategy: 'per-line' },
    debugging: { verbose: false, debug: false },
  });
  await service.initialize();
  return service;
}

async function getService(
  tier: 'tiny' | 'small' | 'medium',
  language: 'ch' | 'latin' = 'ch',
  onProgress?: ProgressHandler
): Promise<InstanceType<PaddleOcrServiceCtor>> {
  const key = `${tier}-${language}`;
  let servicePromise = services.get(key);
  if (!servicePromise) {
    servicePromise = createService(tier, language, onProgress).catch((err) => {
      services.delete(key);
      throw err;
    });
    services.set(key, servicePromise);
  }
  return servicePromise;
}

let vietOcrSessions: {
  cnn: ort.InferenceSession;
  encoder: ort.InferenceSession;
  decoder: ort.InferenceSession;
  vocab: string[];
} | null = null;

async function getVietOcrSessions(onProgress?: ProgressHandler) {
  if (vietOcrSessions) return vietOcrSessions;

  const cnnUrl = chrome.runtime.getURL('models/vietocr_cnn.onnx');
  const encoderUrl = chrome.runtime.getURL('models/vietocr_encoder.onnx');
  const decoderUrl = chrome.runtime.getURL('models/vietocr_decoder.onnx');
  const dictUrl = chrome.runtime.getURL('models/vietocr_dict.txt');

  const [cnnBuf, encoderBuf, decoderBuf, dictBuf] = await Promise.all([
    loadModelFile(cnnUrl, 'VietOCR CNN', onProgress),
    loadModelFile(encoderUrl, 'VietOCR Encoder', onProgress),
    loadModelFile(decoderUrl, 'VietOCR Decoder', onProgress),
    loadModelFile(dictUrl, 'VietOCR Dictionary', onProgress),
  ]);

  onProgress?.({ stage: 'loading', message: 'Initializing VietOCR...' });

  const [cnn, encoder, decoder] = await Promise.all([
    ort.InferenceSession.create(cnnBuf),
    ort.InferenceSession.create(encoderBuf),
    ort.InferenceSession.create(decoderBuf),
  ]);

  const dictStr = new TextDecoder('utf-8').decode(dictBuf);
  const vocab = dictStr.split(/\r?\n/).filter(line => line.length > 0);

  vietOcrSessions = { cnn, encoder, decoder, vocab };
  return vietOcrSessions;
}

function cropCanvas(source: HTMLCanvasElement, box: { x: number; y: number; width: number; height: number }): HTMLCanvasElement {
  const crop = document.createElement('canvas');
  crop.width = box.width;
  crop.height = box.height;
  const ctx = crop.getContext('2d');
  if (ctx) {
    ctx.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
  }
  return crop;
}

function hasRepetitiveSuffix(text: string): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length < 3) return false;
  const n = words.length;
  
  // Check 1-word repetition: e.g. "trang trang trang"
  if (words[n - 1] === words[n - 2] && words[n - 2] === words[n - 3]) {
    return true;
  }
  
  // Check 2-word repetition: e.g. "trang choang trang choang"
  if (n >= 6) {
    if (words[n - 1] === words[n - 3] && words[n - 2] === words[n - 4] &&
        words[n - 3] === words[n - 5] && words[n - 4] === words[n - 6]) {
      return true;
    }
  }
  
  return false;
}

async function runVietOcrInference(
  canvas: HTMLCanvasElement, 
  sessions: NonNullable<typeof vietOcrSessions>
): Promise<string> {
  const { cnn, encoder, decoder, vocab } = sessions;

  // 1. Get background color of the crop by sampling the top-right corner pixel
  let padColor = '#FFFFFF';
  try {
    const cropCtx = canvas.getContext('2d');
    if (cropCtx) {
      const sampleX = Math.max(0, canvas.width - 2);
      const sampleY = Math.min(canvas.height - 1, 2);
      const pixel = cropCtx.getImageData(sampleX, sampleY, 1, 1).data;
      if (pixel[3] >= 50) {
        padColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
      }
    }
  } catch (e) {
    console.warn('Failed to sample background color, using white:', e);
  }

  // Preserve aspect ratio: scale height to 32
  let scale = 32 / canvas.height;
  let newWidth = Math.round(canvas.width * scale);

  // Round width to the nearest multiple of 20 (guarantees divisible by 4 for ONNX VGG pooling)
  newWidth = Math.round(newWidth / 20) * 20;
  newWidth = Math.max(40, Math.min(1600, newWidth)); // Keep in valid range

  // Create target canvas of exact resized size (no padding to 1600 necessary!)
  const resizedCanvas = document.createElement('canvas');
  resizedCanvas.width = newWidth;
  resizedCanvas.height = 32;
  const ctx = resizedCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context for crop resize');
  
  ctx.fillStyle = padColor;
  ctx.fillRect(0, 0, newWidth, 32);

  // Draw the original crop scaled to newWidth x 32
  ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, newWidth, 32);

  const imgData = ctx.getImageData(0, 0, newWidth, 32);
  const pix = imgData.data;

  const floatData = new Float32Array(1 * 3 * 32 * newWidth);
  const rOffset = 0;
  const gOffset = 32 * newWidth;
  const bOffset = 2 * 32 * newWidth;

  for (let i = 0; i < 32 * newWidth; i++) {
    const r = pix[i * 4];
    const g = pix[i * 4 + 1];
    const b = pix[i * 4 + 2];
    floatData[rOffset + i] = r / 255.0;
    floatData[gOffset + i] = g / 255.0;
    floatData[bOffset + i] = b / 255.0;
  }

  const imgTensor = new ort.Tensor('float32', floatData, [1, 3, 32, newWidth]);
  const cnnFeeds = { img: imgTensor };
  const cnnResults = await cnn.run(cnnFeeds);
  const srcTensor = cnnResults.output;

  const encoderFeeds = { src: srcTensor };
  const encoderResults = await encoder.run(encoderFeeds);
  const encoderOutputs = encoderResults.encoder_outputs;
  let hidden = encoderResults.hidden;

  const maxSeqLength = 128;
  const sosToken = 1;
  const eosToken = 2;

  let translatedSentence: number[] = [sosToken];
  let maxLength = 0;

  while (maxLength <= maxSeqLength) {
    const tgtVal = BigInt64Array.from([BigInt(translatedSentence[translatedSentence.length - 1])]);
    const tgtTensor = new ort.Tensor('int64', tgtVal, [1]);

    const decoderFeeds = {
      tgt: tgtTensor,
      hidden: hidden,
      encoder_outputs: encoderOutputs,
    };

    const decoderResults = await decoder.run(decoderFeeds);
    const outputTensor = decoderResults.output;
    hidden = decoderResults.hidden_out;

    const outputData = outputTensor.data as Float32Array;
    
    let maxIdx = 0;
    let maxVal = outputData[0];
    for (let j = 1; j < outputData.length; j++) {
      if (outputData[j] > maxVal) {
        maxVal = outputData[j];
        maxIdx = j;
      }
    }

    if (maxIdx === eosToken) {
      break;
    }

    translatedSentence.push(maxIdx);
    maxLength++;

    // Safety net: check if current decoded suffix has repetition
    let currentText = '';
    for (let i = 1; i < translatedSentence.length; i++) {
      const idx = translatedSentence[i];
      if (idx === eosToken) break;
      if (idx < 4) continue;
      const char = vocab[idx - 4];
      if (char) currentText += char;
    }
    if (hasRepetitiveSuffix(currentText)) {
      break;
    }
  }

  let decodedText = '';
  for (let i = 1; i < translatedSentence.length; i++) {
    const idx = translatedSentence[i];
    if (idx === eosToken) break;
    if (idx < 4) continue;
    const char = vocab[idx - 4];
    if (char) {
      decodedText += char;
    }
  }

  return decodedText.trim();
}

function sortByReadingOrder<T extends { box: { x: number; y: number; height: number } }>(results: T[]): T[] {
  return [...results].sort((a, b) => {
    if (Math.abs(a.box.y - b.box.y) < (a.box.height + b.box.height) / 4) {
      return a.box.x - b.box.x;
    }
    return a.box.y - b.box.y;
  });
}

function groupResultsIntoLines<T extends { box: { x: number; y: number; height: number } }>(results: T[]): T[][] {
  if (results.length === 0) return [];
  const lines: T[][] = [];
  let currentLine: T[] = [results[0]];
  let currentLineHeightSum = results[0].box.height;
  let avgHeight = results[0].box.height;

  for (let i = 1; i < results.length; i++) {
    const current = results[i];
    const previous = results[i - 1];
    const verticalGap = Math.abs(current.box.y - previous.box.y);
    const threshold = avgHeight * 0.5;

    if (verticalGap <= threshold) {
      currentLine.push(current);
      currentLineHeightSum += current.box.height;
      avgHeight = currentLineHeightSum / currentLine.length;
    } else {
      currentLine.sort((a, b) => a.box.x - b.box.x);
      lines.push(currentLine);
      currentLine = [current];
      currentLineHeightSum = current.box.height;
      avgHeight = current.box.height;
    }
  }

  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.box.x - b.box.x);
    lines.push(currentLine);
  }

  return lines;
}

export async function recognizeImageRegion(
  canvas: HTMLCanvasElement,
  tier: 'tiny' | 'small' | 'medium' = 'small',
  language: 'ch' | 'latin' = 'ch',
  onProgress?: ProgressHandler
): Promise<string> {
  if (language === 'latin') {
    const service = await getService(tier, 'ch', onProgress);
    const sessions = await getVietOcrSessions(onProgress);

    onProgress?.({ stage: 'recognizing', message: 'Detecting text boxes...' });
    const boxes = await (service as any).detector.run(canvas);

    if (boxes.length === 0) {
      return '';
    }

    onProgress?.({ stage: 'recognizing', message: 'Reading text with VietOCR...' });

    const results: { text: string; box: any }[] = [];
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      
      // Expand the box vertically and horizontally to prevent cutting off accents/descenders/edge chars
      const verticalPadding = Math.max(6, Math.round(box.height * 0.3));
      const horizontalPadding = Math.max(4, Math.round(box.width * 0.01));
      const expandedBox = {
        x: Math.max(0, box.x - horizontalPadding),
        y: Math.max(0, box.y - verticalPadding),
        width: Math.min(canvas.width - Math.max(0, box.x - horizontalPadding), box.width + horizontalPadding * 2),
        height: Math.min(canvas.height - Math.max(0, box.y - verticalPadding), box.height + verticalPadding * 2)
      };

      const crop = cropCanvas(canvas, expandedBox);
      try {
        const text = await runVietOcrInference(crop, sessions);
        results.push({ text, box });
      } catch (err) {
        console.error(`VietOCR failed to recognize box ${i}:`, err);
        results.push({ text: '', box });
      }
    }

    const sorted = sortByReadingOrder(results);
    const lines = groupResultsIntoLines(sorted);
    const fullText = lines.map(line => line.map(r => r.text).join(' ')).join('\n');
    return fullText.trim();
  } else {
    const service = await getService(tier, language, onProgress);
    onProgress?.({ stage: 'recognizing', message: 'Reading text from image...' });
    const result = await service.recognize(canvas, { flatten: false, strategy: 'per-line' });
    return result.text.trim();
  }
}
