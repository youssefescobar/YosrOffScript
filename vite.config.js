import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, runnerImport } from 'vite';

// Dev only: serve ./media-out at /media/ (with Range support so seeking works)
// so the site can be built before media is uploaded to the CDN.
function serveLocalMedia() {
  const dir = path.resolve('media-out');
  const types = { '.mp4': 'video/mp4', '.webp': 'image/webp' };
  return {
    name: 'serve-local-media',
    configureServer(server) {
      server.middlewares.use('/media/', (req, res, next) => {
        const file = path.join(dir, path.basename(decodeURIComponent(req.url.split('?')[0])));
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        const { size } = fs.statSync(file);
        const type = types[path.extname(file)] || 'application/octet-stream';
        const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
        if (range) {
          const start = range[1] ? Number(range[1]) : 0;
          const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
          res.writeHead(206, {
            'Content-Type': type,
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': end - start + 1,
          });
          fs.createReadStream(file, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Type': type,
            'Accept-Ranges': 'bytes',
            'Content-Length': size,
          });
          fs.createReadStream(file).pipe(res);
        }
      });
    },
  };
}

// Build only: one HTML page per category and film (/fashion, /fashion/casa-lila,
// /about), each a copy of index.html with its own title, description, share
// image and canonical URL, so shared links preview the right film and search
// engines can index every page. The app itself still boots from the URL.
function prerenderPages() {
  let outDir;
  return {
    name: 'prerender-pages',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const { module: data } = await runnerImport('/src/projects.js', {
        mode: 'production',
        logLevel: 'error',
      });
      const { CATEGORIES, VIDEOS, SITE_URL, SITE_NAME, getCategory, pageTitle } = data;
      const template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');

      const esc = (v) =>
        String(v).replace(
          /[&<>"]/g,
          (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
        );
      const setTag = (html, re, value) => {
        if (!re.test(html)) throw new Error(`prerender: no match for ${re}`);
        return html.replace(re, `$1${esc(value)}$2`);
      };

      function page({ file, title, description, url, image, type = 'website', jsonLd = null }) {
        let html = template;
        html = setTag(html, /(<title>)[^<]*(<\/title>)/, title);
        html = setTag(html, /(<meta name="description" content=")[^"]*(")/, description);
        html = setTag(html, /(<link rel="canonical" href=")[^"]*(")/, url);
        html = setTag(html, /(<meta property="og:title" content=")[^"]*(")/, title);
        html = setTag(html, /(<meta property="og:description" content=")[^"]*(")/, description);
        html = setTag(html, /(<meta property="og:url" content=")[^"]*(")/, url);
        html = setTag(html, /(<meta property="og:type" content=")[^"]*(")/, type);
        if (image) {
          html = setTag(html, /(<meta property="og:image" content=")[^"]*(")/, image);
          html = setTag(html, /(<meta name="twitter:image" content=")[^"]*(")/, image);
        }
        if (jsonLd) {
          const ld = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
          html = html.replace(
            '</head>',
            `  <script type="application/ld+json">${ld}</script>\n  </head>`
          );
        }
        const dest = path.join(outDir, `${file}.html`);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, html);
      }

      const absolute = (u) => new URL(u, SITE_URL).href;

      page({
        file: 'about',
        title: pageTitle({ about: true }),
        description:
          'Yosr — creative director focused on branding, editorial design, and visual storytelling. Based between Egypt & Saudi Arabia, open to freelance and collaborations.',
        url: `${SITE_URL}/about`,
        type: 'profile',
      });

      for (const cat of CATEGORIES) {
        const films = VIDEOS.filter((v) => v.category === cat.id);
        page({
          file: cat.id,
          title: pageTitle({ category: cat.id }),
          description: `${cat.label} — ${films.length} ${films.length === 1 ? 'film' : 'films'} by ${SITE_NAME}, visual storyteller.`,
          url: `${SITE_URL}/${cat.id}`,
          image: absolute(cat.cover),
        });
      }

      for (const v of VIDEOS) {
        const label = getCategory(v.category).label;
        const description =
          v.description ||
          `${v.title}${v.brand ? ` for ${v.brand}` : ''} — ${label} film by ${SITE_NAME}.`;
        const url = `${SITE_URL}${v.path}`;
        page({
          file: v.path.slice(1),
          title: pageTitle({ video: v }),
          description,
          url,
          image: absolute(v.poster),
          type: 'video.other',
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'VideoObject',
            name: v.title,
            description,
            thumbnailUrl: absolute(v.poster),
            contentUrl: absolute(v.src),
            uploadDate: v.uploadDate,
            duration: `PT${Math.round(v.duration)}S`,
            url,
            creator: {
              '@type': 'Person',
              name: 'Yosr',
              alternateName: SITE_NAME,
              url: `${SITE_URL}/`,
            },
          },
        });
      }

      const urls = [
        '/',
        '/about',
        ...CATEGORIES.map((c) => `/${c.id}`),
        ...VIDEOS.map((v) => v.path),
      ];
      fs.writeFileSync(
        path.join(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map((u) => `  <url><loc>${SITE_URL}${u === '/' ? '/' : u}</loc></url>`)
          .join('\n')}\n</urlset>\n`
      );
    },
  };
}

export default defineConfig({
  plugins: [serveLocalMedia(), prerenderPages()],
  server: {
    open: true,
  },
});
