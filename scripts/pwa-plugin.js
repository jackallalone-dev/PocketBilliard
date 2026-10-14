import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function pwaPlugin() {
  return {
    name: 'pocket-club-offline',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const publicFiles = ['manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
        const files = [...Object.keys(bundle).filter((file) => !file.endsWith('.map')), ...publicFiles].sort();
        const template = readFileSync(new URL('../src/service-worker.js', import.meta.url), 'utf8');
        const hash = createHash('sha256').update(template);
        for (const file of files) {
          hash.update(file);
          hash.update(bundle[file] ? (bundle[file].type === 'chunk' ? bundle[file].code : bundle[file].source) : readFileSync(new URL(`../public/${file}`, import.meta.url)));
        }
        const source = template.replace('__CACHE_VERSION__', JSON.stringify(hash.digest('hex').slice(0, 16)))
          .replace('__PRECACHE_FILES__', JSON.stringify(files));
        this.emitFile({ type: 'asset', fileName: 'sw.js', source });
      },
    },
  };
}
