#!/usr/bin/env node
// Vite's relative base is resolved against the project root, so building the
// viewer into ../dist-viewer emits links like "../../../Vv4D_Meta/...js" in
// index.html. The bundles live right next to index.html under assets/, so any
// emitted URL is rewritten to "./assets/<file>".
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? '.');
const file = join(dir, 'index.html');
const html = readFileSync(file, 'utf8');
const fixed = html.replace(/((?:src|href)=")([^"]+)"/g, (match, attribute, url) => {
  // Leave absolute URLs, protocol-relative, anchors and data URIs alone.
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) return match;
  const index = url.indexOf('assets/');
  if (index < 0) return match;
  return `${attribute}./${url.slice(index)}"`;
});
if (fixed === html) {
  console.log('index.html already uses relative paths.');
} else {
  writeFileSync(file, fixed);
  console.log('Fixed asset paths in', file);
}
