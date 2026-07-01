import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsDir = path.resolve(__dirname, '../public/models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const files = [
  { url: 'https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main/detection/ort/PP-OCRv6_tiny_det.ort', name: 'PP-OCRv6_tiny_det.ort' },
  { url: 'https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main/recognition/ort/PP-OCRv6_tiny_rec.ort', name: 'PP-OCRv6_tiny_rec.ort' },
  { url: 'https://raw.githubusercontent.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main/recognition/ppocrv6_tiny_dict.txt', name: 'ppocrv6_tiny_dict.txt' },

  { url: 'https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main/detection/ort/PP-OCRv6_small_det.ort', name: 'PP-OCRv6_small_det.ort' },
  { url: 'https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main/recognition/ort/PP-OCRv6_small_rec.ort', name: 'PP-OCRv6_small_rec.ort' },
  { url: 'https://raw.githubusercontent.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main/recognition/ppocrv6_dict.txt', name: 'ppocrv6_dict.txt' },

  { url: 'https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main/detection/ort/PP-OCRv6_medium_det.ort', name: 'PP-OCRv6_medium_det.ort' },
  { url: 'https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main/recognition/ort/PP-OCRv6_medium_rec.ort', name: 'PP-OCRv6_medium_rec.ort' },

  { url: 'https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main/detection/PP-OCRv5_mobile_det_infer.onnx', name: 'PP-OCRv5_latin_det.onnx' },
  { url: 'https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main/recognition/multi/latin/v5/latin_PP-OCRv5_mobile_rec_infer.onnx', name: 'PP-OCRv5_latin_rec.onnx' },
  { url: 'https://raw.githubusercontent.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main/recognition/multi/latin/v5/ppocrv5_latin_dict.txt', name: 'ppocrv5_latin_dict.txt' }
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log('Starting OCR models download...');
  for (const f of files) {
    const dest = path.join(modelsDir, f.name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log(`File ${f.name} already exists. Skipping.`);
      continue;
    }
    console.log(`Downloading ${f.name} (from ${f.url})...`);
    try {
      await download(f.url, dest);
      console.log(`Successfully saved ${f.name}`);
    } catch (e) {
      console.error(`Failed to download ${f.name}:`, e.message);
    }
  }
  console.log('All downloads completed!');
}

run();
