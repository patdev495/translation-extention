import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DICT_URL = 'https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_US.txt';
const OUTPUT_DIR = path.resolve(__dirname, '../src/assets');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'cmu-dict.json');

async function buildDict() {
  console.log(`Fetching English IPA dictionary from: ${DICT_URL}`);
  try {
    const response = await fetch(DICT_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch dictionary: ${response.statusText}`);
    }
    const text = await response.text();
    console.log('Fetched successfully. Parsing...');

    const lines = text.split('\n');
    const dict = {};
    let count = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length >= 2) {
        let word = parts[0].trim().toLowerCase();
        let ipa = parts[1].trim();
        
        // Strip leading/trailing slashes first to prevent empty first split element
        if (ipa.startsWith('/')) ipa = ipa.slice(1);
        if (ipa.endsWith('/')) ipa = ipa.slice(0, -1);
        
        // Take the first pronunciation if multiple are listed
        ipa = ipa.split(/\/, \/|\/|,\s*/)[0].trim();
        
        // Only keep sensible words (no weird symbols or numbers)
        if (/^[a-z'-]+$/.test(word)) {
          dict[word] = ipa;
          count++;
        }
      }
    }

    console.log(`Parsed ${count} valid words.`);

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write to JSON
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dict, null, 2), 'utf-8');
    console.log(`Saved dictionary successfully to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('Error building dictionary:', error);
    process.exit(1);
  }
}

buildDict();
