import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

// Ensure clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Static web assets to copy into dist
const itemsToCopy = [
  'index.html',
  'css',
  'js',
  'data.json',
  'data_en.json',
  'syllabi.json',
];

for (const item of itemsToCopy) {
  const src = path.join(rootDir, item);
  const dest = path.join(distDir, item);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
  }
}

console.log('✓ Successfully prepared clean web assets in dist/ for Tauri & Cloudflare Pages');
