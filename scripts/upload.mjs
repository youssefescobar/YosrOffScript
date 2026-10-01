/* ===================================================
   Upload media-out/ to the Cloudflare R2 bucket.

   Usage:  node scripts/upload.mjs [bucket]
   Needs a one-time `npx wrangler login` first.
   Only files listed in src/media-manifest.json are uploaded.
   Filenames carry a content hash, so they are cached for a year.
   =================================================== */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'media-out');
const BUCKET = process.argv[2] || 'yosroffscript-media';
const TYPES = { '.mp4': 'video/mp4', '.webp': 'image/webp' };

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'media-manifest.json'), 'utf8'));
const files = Object.values(manifest).flatMap((m) => Object.values(m.files));

let failed = 0;
for (const name of files) {
  const file = path.join(OUT_DIR, name);
  if (!fs.existsSync(file)) {
    console.error(`missing: ${name} (run scripts/encode.mjs)`);
    failed++;
    continue;
  }
  process.stdout.write(`${name} ... `);
  const r = spawnSync(
    'npx',
    [
      'wrangler', 'r2', 'object', 'put', `${BUCKET}/${name}`,
      '--file', file,
      '--content-type', TYPES[path.extname(name)],
      // quoted: shell:true would otherwise split on the spaces
      '--cache-control', '"public, max-age=31536000, immutable"',
      '--remote',
    ],
    { encoding: 'utf8', shell: true }
  );
  if (r.status === 0) {
    console.log('ok');
  } else {
    failed++;
    console.log('FAILED');
    console.error((r.stderr || r.stdout || '').split('\n').slice(-6).join('\n'));
  }
}

console.log(failed ? `\n${failed} file(s) failed` : `\nuploaded ${files.length} files to ${BUCKET}`);
process.exit(failed ? 1 : 0);
