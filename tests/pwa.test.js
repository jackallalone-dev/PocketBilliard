import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { pwaPlugin } from '../scripts/pwa-plugin.js';

function buildWorker(code = 'console.log("app")') {
  let output;
  pwaPlugin().generateBundle.handler.call({ emitFile(file) { output = file; } }, {}, {
    'index.html': { type: 'asset', source: '<title>Pocket Club</title>' },
    'assets/game-123.js': { type: 'chunk', code },
    'assets/game-123.js.map': { type: 'asset', source: '{}' },
  });
  return output.source;
}

function worker(scope, cacheStore = new Map()) {
  const listeners = new Map(), state = { claimed: false, requested: [] };
  const caches = {
    async keys() { return [...cacheStore.keys()]; },
    async delete(key) { return cacheStore.delete(key); },
    async open(key) {
      if (!cacheStore.has(key)) cacheStore.set(key, new Map());
      const files = cacheStore.get(key);
      return {
        async addAll(urls) { for (const url of urls) { state.requested.push(url);files.set(url, `cached:${url}`); } },
        async match(url) { return files.get(url); },
      };
    },
  };
  runInNewContext(buildWorker(), {
    URL, caches,
    self: { registration: { scope }, clients: { async claim() { state.claimed = true; } }, addEventListener: (name, callback) => listeners.set(name, callback) },
    fetch() { throw new Error('Offline'); },
  });
  return {
    state, cacheStore,
    async lifecycle(name) { let done;listeners.get(name)({ waitUntil(promise) { done = promise; } });await done; },
    async request(url, mode = 'navigate', method = 'GET') {
      let response;
      listeners.get('fetch')({ request: { url, mode, method }, respondWith(value) { response = value; } });
      return response;
    },
  };
}

test('production worker precaches build assets and reloads offline at the root or a GitHub Pages subpath', async () => {
  for (const scope of ['https://example.test/', 'https://example.test/PocketBilliard/']) {
    const app = worker(scope);await app.lifecycle('install');await app.lifecycle('activate');
    assert.equal(app.state.claimed, true);
    assert.ok(app.state.requested.includes(scope + 'assets/game-123.js'));
    assert.ok(app.state.requested.includes(scope + 'manifest.webmanifest'));
    assert.ok(app.state.requested.every(url => url.startsWith(scope) && !url.endsWith('.map')));
    assert.equal(await app.request(scope + '?from=homescreen'), `cached:${scope}index.html`);
    assert.equal(await app.request(scope + 'index.html'), `cached:${scope}index.html`);
    assert.equal(await app.request(scope + 'assets/game-123.js', 'cors'), `cached:${scope}assets/game-123.js`);
    assert.equal(await app.request(scope + 'icons/icon-192.png', 'no-cors'), `cached:${scope}icons/icon-192.png`);
    assert.equal(await app.request('https://other.test/PocketBilliard/'), undefined);
    assert.equal(await app.request(scope + 'unknown-file'), undefined);
    assert.equal(await app.request(scope, 'navigate', 'POST'), undefined);
  }
});

test('cache updates preserve other GitHub Pages apps and use a new version when app content changes', async () => {
  const scope = 'https://example.test/PocketBilliard/';
  const cacheStore = new Map([
    [`pocket-club:${scope}:old-build`, new Map()],
    ['pocket-club:https://example.test/another-game/:old-build', new Map()],
    ['unrelated-app', new Map()],
  ]);
  const app = worker(scope, cacheStore);await app.lifecycle('install');
  assert.ok(cacheStore.has(`pocket-club:${scope}:old-build`), 'installation must not remove the version used by an open game');
  await app.lifecycle('activate');
  assert.equal(cacheStore.has(`pocket-club:${scope}:old-build`), false);
  assert.ok(cacheStore.has('pocket-club:https://example.test/another-game/:old-build'));
  assert.ok(cacheStore.has('unrelated-app'));
  const version = (source) => source.match(/const CACHE = PREFIX \+ "([a-f0-9]+)"/)[1];
  assert.notEqual(version(buildWorker()), version(buildWorker('console.log("new build")')));
});

test('install manifest resolves inside the repo and ships real PNG icons at declared sizes', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url)));
  const base = 'https://example.test/PocketBilliard/manifest.webmanifest';
  assert.equal(manifest.display, 'standalone');
  for (const key of ['id', 'start_url', 'scope']) assert.equal(new URL(manifest[key], base).href, 'https://example.test/PocketBilliard/');
  for (const icon of manifest.icons) {
    const png = readFileSync(new URL(`../public/${icon.src}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});
