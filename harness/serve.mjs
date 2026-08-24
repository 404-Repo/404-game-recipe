#!/usr/bin/env node
/**
 * Static server, for looking at a game or an asset by hand. ES modules will not
 * import over file://, so anything that loads an asset needs this running.
 *
 *   node harness/serve.mjs                     -> the repo, on http://localhost:8080
 *   node harness/serve.mjs ~/mygame/game       -> that game too, from anywhere on disk
 *   node harness/serve.mjs ~/mygame/game 9000  -> on a different port
 *
 * Takes the same argument playtest.mjs does, the directory holding the game's
 * index.html, and mounts it the same way: the game's PARENT under a prefix, so a
 * sibling assets/ directory resolves, with the repo as the fallback so
 * ../harness/assetlib.js still finds this repo.
 */
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const target = args[0] && !/^\d+$/.test(args[0]) ? path.resolve(args[0]) : null;
const port = +(args.find((a) => /^\d+$/.test(a)) || 8080);
if (target && !fs.existsSync(target)) {
  console.error(`no such directory: ${target}`);
  process.exit(1);
}

const GAME_PREFIX = '/__game__/';
const MOUNT = target ? path.dirname(target) : null;
const GAME_URL = target ? `${GAME_PREFIX}${path.basename(target)}/` : null;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
               '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
               '.css': 'text/css', '.svg': 'image/svg+xml' };

function resolveRequest(urlPath) {
  if (MOUNT && urlPath.startsWith(GAME_PREFIX)) {
    const file = path.join(MOUNT, urlPath.slice(GAME_PREFIX.length));
    if (file.startsWith(MOUNT) && fs.existsSync(file)) return file;
  }
  const file = path.join(ROOT, MOUNT && urlPath.startsWith(GAME_PREFIX)
    ? urlPath.slice(GAME_PREFIX.length - 1) : urlPath);
  return file.startsWith(ROOT) ? file : null;
}

createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/favicon.ico') { res.writeHead(204); return res.end(); }

  // A directory asked for without its trailing slash has to REDIRECT, not just
  // serve the index. Answering /game with the contents of /game/index.html
  // leaves the browser's base URL at the parent, so the page's own './main.js'
  // is fetched from the wrong place and the game hangs on its loading screen
  // with no error. That cost a link that had passed every other check.
  const asDir = resolveRequest(rel.endsWith('/') ? rel : rel + '/');
  if (!rel.endsWith('/') && asDir && fs.existsSync(asDir) && fs.statSync(asDir).isDirectory()) {
    res.writeHead(302, { Location: rel + '/' });
    return res.end();
  }
  if (rel.endsWith('/')) rel += 'index.html';

  const file = resolveRequest(rel);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`serving ${ROOT} on http://localhost:${port}`);
  if (target) console.log(`your game: http://localhost:${port}${GAME_URL}`);
  else console.log('pass a game directory to serve one that lives outside this repo');
});
