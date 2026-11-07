#!/usr/bin/env node
// Zero-dependency static server for the packaged viewer.
// Usage: node serve.mjs [folder] [port]
// Why a server: browsers block ES modules, workers and fetch over file://,
// so the viewer has to be opened through http://localhost.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(process.argv[2] ?? fileURLToPath(new URL('.', import.meta.url)));
const startPort = Number(process.env.PORT ?? process.argv[3] ?? 8080);
const maxPort = startPort + 20;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.tza': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.ply': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.hdr': 'image/vnd.radiance',
  '.exr': 'image/x-exr',
  '.ktx2': 'image/ktx2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json'
};

function resolveFile(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  let file = normalize(join(root, pathname));
  if (file !== root && !file.startsWith(root + sep)) return null;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) && !extname(file)) file = join(root, 'index.html');
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method Not Allowed');
    return;
  }
  const file = resolveFile(req.url ?? '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Not found: ${req.url}`);
    return;
  }
  const stats = statSync(file);
  res.writeHead(200, {
    'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stats.size,
    // Rebuilt binaries may keep the same names.
    'Cache-Control': 'no-cache'
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
});

function open(url) {
  const commands = { win32: ['cmd', ['/c', 'start', '', url]], darwin: ['open', [url]], linux: ['xdg-open', [url]] };
  const command = commands[process.platform];
  if (!command) return;
  try {
    spawn(command[0], command[1], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // Opening the browser is a convenience; the URL is printed below.
  }
}

function listen(port) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < maxPort) listen(port + 1);
    else {
      console.error(`Cannot start the server: ${error.message}`);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log('');
    console.log('MuTracer viewer is running.');
    console.log(`  Folder: ${root}`);
    console.log(`  URL:    ${url}`);
    console.log('Close this window or press Ctrl+C to stop.');
    console.log('');
    if (process.env.NO_OPEN !== '1') open(url);
  });
}

listen(startPort);
