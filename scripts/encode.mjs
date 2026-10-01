/* ===================================================
   Encode portfolio sources -> web-ready media.

   Usage:  node scripts/encode.mjs [--src "<folder>"] [--force]

   For every video found under the source folder (one subfolder per
   category) this writes to media-out/:
     <slug>.<hash>.mp4          1080p H.264, faststart (detail player)
     <slug>-preview.<hash>.mp4  ~4s muted loop (grid cards)
     <slug>.<hash>.webp         poster frame
   and updates src/media-manifest.json.

   Needs ffmpeg + ffprobe on PATH (or set FFMPEG_DIR).
   Optional scripts/poster-overrides.json: { "<slug>": <seconds> }
   =================================================== */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'media-out');
const MANIFEST = path.join(ROOT, 'src', 'media-manifest.json');
const OVERRIDES = path.join(ROOT, 'scripts', 'poster-overrides.json');

const DEFAULT_SRC = 'C:\\Users\\usef\\Desktop\\Portfolio Projects';

// source folder name -> category id used in src/projects.js
const FOLDER_TO_CATEGORY = {
  'behind the scenes_': 'bts',
  'behind the scenes': 'bts',
  events: 'events',
  'fashion & apparel_': 'fashion',
  'fashion & apparel': 'fashion',
  film: 'film',
  'f&b': 'fnb',
  'f&b_': 'fnb',
};

const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v']);

const args = process.argv.slice(2);
const force = args.includes('--force');
const srcIdx = args.indexOf('--src');
const SRC_DIR = srcIdx >= 0 ? args[srcIdx + 1] : DEFAULT_SRC;

const binDir = process.env.FFMPEG_DIR;
const bin = (name) => (binDir ? path.join(binDir, name) : name);

function run(cmd, cmdArgs) {
  const r = spawnSync(bin(cmd), cmdArgs, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.error) throw new Error(`${cmd} failed to start: ${r.error.message}`);
  if (r.status !== 0) {
    throw new Error(`${cmd} exited ${r.status}\n${(r.stderr || '').split('\n').slice(-12).join('\n')}`);
  }
  return r.stdout;
}

function probe(file) {
  const out = run('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    file,
  ]);
  const json = JSON.parse(out);
  const v = json.streams.find((s) => s.codec_type === 'video');
  if (!v) throw new Error(`no video stream in ${file}`);
  const [num, den] = (v.avg_frame_rate || v.r_frame_rate || '30/1').split('/').map(Number);
  // honour display rotation (iPhone clips may be stored rotated)
  const rot = Math.abs(Number(v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation || 0)) % 180;
  const width = rot === 90 ? v.height : v.width;
  const height = rot === 90 ? v.width : v.height;
  return {
    width,
    height,
    fps: den ? num / den : 30,
    duration: Number(json.format.duration),
    hdr: v.color_transfer === 'arib-std-b67' || v.color_transfer === 'smpte2084',
  };
}

function slugify(s) {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hashFile(file) {
  return createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
}

// Rename <tmp> to <base>.<hash><ext> inside OUT_DIR, return the new file name.
function finalize(tmp, base, ext) {
  const name = `${base}.${hashFile(tmp)}${ext}`;
  fs.renameSync(tmp, path.join(OUT_DIR, name));
  return name;
}

// HLG/PQ phone footage -> SDR BT.709 so colours do not wash out on SDR screens.
const HDR_TO_SDR =
  'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,' +
  'zscale=t=bt709:m=bt709:r=tv,format=yuv420p';

// Cap the short edge (so a 1080x1920 clip stays 1080x1920, never upscaled).
const capShortEdge = (px) =>
  `scale='if(gt(iw,ih),-2,min(${px},iw))':'if(gt(iw,ih),min(${px},ih),-2)'`;

function filters(info, shortEdge) {
  const f = [];
  if (info.hdr) f.push(HDR_TO_SDR);
  if (info.fps > 30.5) f.push('fps=30');
  f.push(capShortEdge(shortEdge));
  f.push('format=yuv420p');
  return f.join(',');
}

function encodeFull(src, info, outTmp) {
  run('ffmpeg', [
    '-y', '-v', 'error',
    '-i', src,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', filters(info, 1080),
    '-c:v', 'libx264', '-preset', 'medium', '-profile:v', 'high', '-crf', '26', '-maxrate', '4M', '-bufsize', '8M',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    outTmp,
  ]);
}

function encodePreview(src, info, outTmp) {
  const len = 4;
  const start = info.duration > len + 1 ? Math.max(0, info.duration * 0.2) : 0;
  run('ffmpeg', [
    '-y', '-v', 'error',
    '-ss', start.toFixed(2),
    '-i', src,
    '-t', String(len),
    '-map', '0:v:0', '-an',
    '-vf', filters(info, 540),
    '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'main', '-crf', '27',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart',
    outTmp,
  ]);
}

function encodePoster(src, info, outTmp, at) {
  const t = at ?? info.duration / 2;
  run('ffmpeg', [
    '-y', '-v', 'error',
    '-ss', t.toFixed(2),
    '-i', src,
    '-frames:v', '1',
    '-vf', filters(info, 720),
    '-c:v', 'libwebp', '-quality', '82',
    outTmp,
  ]);
}

function findSources(dir) {
  const found = [];
  for (const folder of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const category = FOLDER_TO_CATEGORY[folder.name.toLowerCase()];
    if (!category) {
      console.warn(`skip folder (no category mapping): ${folder.name}`);
      continue;
    }
    for (const f of fs.readdirSync(path.join(dir, folder.name), { withFileTypes: true })) {
      if (!f.isFile() || !VIDEO_EXT.has(path.extname(f.name).toLowerCase())) continue;
      const full = path.join(dir, folder.name, f.name);
      const stat = fs.statSync(full);
      found.push({
        category,
        file: full,
        slug: `${category}-${slugify(path.basename(f.name, path.extname(f.name)))}`,
        size: stat.size,
        mtimeMs: Math.round(stat.mtimeMs),
      });
    }
  }
  return found.sort((a, b) => a.slug.localeCompare(b.slug));
}

function main() {
  if (!fs.existsSync(SRC_DIR)) throw new Error(`source folder not found: ${SRC_DIR}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const prev = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  const overrides = fs.existsSync(OVERRIDES) ? JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')) : {};
  const sources = findSources(SRC_DIR);
  const manifest = {};

  const slugs = new Set();
  for (const s of sources) {
    if (slugs.has(s.slug)) throw new Error(`duplicate slug: ${s.slug}`);
    slugs.add(s.slug);
  }

  for (const s of sources) {
    const old = prev[s.slug];
    const sameSource = old && old.source.size === s.size && old.source.mtimeMs === s.mtimeMs;
    const filesExist =
      old && Object.values(old.files).every((n) => fs.existsSync(path.join(OUT_DIR, n)));
    const posterSame = old && old.posterAt === (overrides[s.slug] ?? null);

    if (!force && sameSource && filesExist && posterSame) {
      console.log(`= ${s.slug} (unchanged)`);
      manifest[s.slug] = old;
      continue;
    }

    console.log(`+ ${s.slug}`);
    const info = probe(s.file);
    const tmp = (suffix) => path.join(OUT_DIR, `.tmp-${s.slug}${suffix}`);

    encodeFull(s.file, info, tmp('.mp4'));
    const video = finalize(tmp('.mp4'), s.slug, '.mp4');

    encodePreview(s.file, info, tmp('-p.mp4'));
    const preview = finalize(tmp('-p.mp4'), `${s.slug}-preview`, '.mp4');

    encodePoster(s.file, info, tmp('.webp'), overrides[s.slug]);
    const poster = finalize(tmp('.webp'), s.slug, '.webp');

    const mb = (n) => (fs.statSync(path.join(OUT_DIR, n)).size / 1048576).toFixed(1);
    console.log(
      `    ${info.width}x${info.height} ${info.duration.toFixed(1)}s${info.hdr ? ' HDR->SDR' : ''}` +
        ` | video ${mb(video)}MB preview ${mb(preview)}MB poster ${mb(poster)}MB`
    );

    manifest[s.slug] = {
      slug: s.slug,
      category: s.category,
      width: info.width,
      height: info.height,
      duration: Math.round(info.duration * 10) / 10,
      aspect: Math.round((info.width / info.height) * 1000) / 1000,
      source: { size: s.size, mtimeMs: s.mtimeMs },
      posterAt: overrides[s.slug] ?? null,
      files: { video, preview, poster },
    };
  }

  // Drop stale outputs no longer referenced by the manifest.
  const keep = new Set(Object.values(manifest).flatMap((m) => Object.values(m.files)));
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (!keep.has(f)) fs.rmSync(path.join(OUT_DIR, f), { force: true });
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  const total = [...keep].reduce((n, f) => n + fs.statSync(path.join(OUT_DIR, f)).size, 0);
  console.log(`\n${Object.keys(manifest).length} videos, ${(total / 1048576).toFixed(0)} MB in media-out/`);
}

main();
