import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

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

export default defineConfig({
  plugins: [serveLocalMedia()],
  server: {
    open: true,
  },
});
