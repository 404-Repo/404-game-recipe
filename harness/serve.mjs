#!/usr/bin/env node
/**
 * Static server for the repo root. ES modules will not import over file://, so
 * anything that loads an asset needs this running.
 *
 *   node harness/serve.mjs          -> http://localhost:8080
 *   node harness/serve.mjs 9000     -> a different port
 */
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = +(process.argv[2] || 8080);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
               '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
               '.css': 'text/css', '.svg': 'image/svg+xml' };

createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`serving ${ROOT} on http://localhost:${port}`);
  console.log(`game:   http://localhost:${port}/examples/game/`);
});
