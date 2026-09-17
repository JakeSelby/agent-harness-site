#!/usr/bin/env node
// Post-build smoke test. Reads the manifest the site publishes and refuses a
// build that is missing a page, a search index, a 404, or that renders a
// submodule commit which is not the tagged release VERSION claims.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const vendor = path.join(root, 'vendor/agent-harness');
let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`✗ ${msg}`);
};

const manifestFile = path.join(dist, 'manifest.json');
if (!fs.existsSync(manifestFile)) {
  fail('dist/manifest.json missing — did the build run?');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));

// Every route in the manifest is a page on disk.
const fileFor = (route) => {
  const clean = route.replace(/[#?].*$/, '');
  if (clean === '/') return path.join(dist, 'index.html');
  if (clean.endsWith('/')) return path.join(dist, clean.slice(1), 'index.html');
  if (path.extname(clean)) return path.join(dist, clean.slice(1));
  return path.join(dist, clean.slice(1), 'index.html');
};
for (const r of manifest.routes) {
  if (!fs.existsSync(fileFor(r.route))) fail(`route ${r.route} (${r.kind} ${r.id}) has no index.html`);
}

for (const must of ['404.html', 'pagefind/pagefind.js', 'sitemap-index.xml', 'manifest.json']) {
  if (!fs.existsSync(path.join(dist, must))) fail(`dist/${must} missing`);
}

// The submodule is at the tagged release the site claims to render.
const version = fs.readFileSync(path.join(vendor, 'VERSION'), 'utf8').trim();
if (manifest.version !== version) fail(`manifest version ${manifest.version} ≠ VERSION ${version}`);
// A CI checkout of the submodule is shallow and carries no tags, so fetch the one
// tag VERSION names before asking whether HEAD is it.
const git = (args) => execSync(`git ${args}`, { cwd: vendor, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
try {
  git(`fetch --quiet --depth=1 origin tag v${version}`);
} catch {
  /* offline or already present: describe below decides */
}
try {
  const tag = git('describe --tags --exact-match');
  if (tag !== `v${version}`) fail(`submodule is at ${tag}, VERSION says v${version}`);
} catch {
  fail(`submodule commit is not the v${version} tag that VERSION names (checkout vendor/agent-harness at that tag)`);
}

// Every internal link resolves to a file in dist.
const htmlFiles = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.html')) htmlFiles.push(p);
  }
};
walk(dist);
let links = 0;
const seen = new Set();
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    links++;
    const target = fileFor(href);
    if (seen.has(target)) continue;
    seen.add(target);
    if (!fs.existsSync(target)) fail(`${path.relative(dist, file)} links to ${href}, which is not in dist`);
  }
}

const pages = htmlFiles.length;
if (pages < manifest.routes.length) fail(`only ${pages} html files for ${manifest.routes.length} routes`);

if (failures) {
  console.error(`\n${failures} smoke failure(s)`);
  process.exit(1);
}
console.log(`✓ v${version}: ${manifest.routes.length} routes, ${pages} pages, ${links} internal links resolve, search index and 404 present`);
