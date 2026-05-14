/**
 * Production static server for NCR Reserves.
 *
 * Replaces `vite preview` which is NOT meant for production.
 *
 * Features:
 *   • Serves dist/ (Vite build output)
 *   • SPA fallback → index.html for non-asset routes
 *   • Strict security headers (CSP, HSTS, X-Frame-Options, etc.)
 *   • Strong MIME type whitelist
 *   • No directory traversal
 *   • Long-cache for hashed assets, no-cache for index.html
 *
 * Zero external deps (uses only Node built-ins) to keep the install
 * surface minimal.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST      = resolve(__dirname, 'dist');
const PORT      = Number.parseInt(process.env.PORT ?? '4173', 10);
const HOST      = process.env.HOST ?? '0.0.0.0';

// ─── MIME types (whitelist; unknown extensions are denied) ────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json',
  '.txt':  'text/plain; charset=utf-8',
};

// ─── Security headers ─────────────────────────────────────────────────────────
// CSP allow-list:
//   • self: own origin (scripts/styles served from /assets)
//   • 'unsafe-inline' on style-src: React inline style={{}} attributes
//   • Google Fonts (CSS + woff2) — pre-existing dependency
//   • Supabase REST + realtime (wss) + Open-Meteo for the weather widget
//   • frame-ancestors 'none' → clickjacking-proof
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ');

function applySecurityHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // Disable client-side caching of the SPA shell; assets are hashed and override below.
  res.setHeader('X-DNS-Prefetch-Control', 'off');
}

// ─── Path resolver (blocks ../ traversal) ─────────────────────────────────────
function resolveSafePath(urlPath) {
  // Strip query/fragment
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  // Collapse and normalize
  const full = normalize(join(DIST, clean));
  // Guard: must stay inside DIST
  if (full !== DIST && !full.startsWith(DIST + sep)) return null;
  return full;
}

// ─── Single request handler ───────────────────────────────────────────────────
async function handler(req, res) {
  applySecurityHeaders(res);

  // Only safe methods on a static server
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }

  const safePath = resolveSafePath(req.url ?? '/');
  if (!safePath) {
    res.writeHead(400);
    return res.end('Bad Request');
  }

  let target = safePath;
  let isShell = false;

  try {
    const st = await stat(target).catch(() => null);
    if (!st || st.isDirectory()) {
      // SPA fallback: any unknown route serves index.html
      target = join(DIST, 'index.html');
      isShell = true;
      const idxSt = await stat(target).catch(() => null);
      if (!idxSt) { res.writeHead(404); return res.end('Not Found'); }
    }

    const ext = extname(target).toLowerCase();
    const mime = MIME[ext];
    if (!mime) {
      // Extension not in whitelist → refuse to serve (defence in depth).
      res.writeHead(404);
      return res.end('Not Found');
    }

    const buf = await readFile(target);
    res.setHeader('Content-Type', mime);
    if (isShell || ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (target.includes(`${sep}assets${sep}`)) {
      // Vite emits hashed filenames in /assets — safe to cache long.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    res.writeHead(200);
    if (req.method === 'HEAD') return res.end();
    return res.end(buf);
  } catch (err) {
    // Never leak filesystem details
    res.writeHead(500);
    return res.end('Internal Server Error');
  }
}

const server = createServer(handler);

server.on('clientError', (_err, socket) => {
  // Defensive: malformed HTTP — drop the socket without echoing details.
  try { socket.destroy(); } catch { /* noop */ }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[ncr-reserves] production server listening on ${HOST}:${PORT}`);
});
