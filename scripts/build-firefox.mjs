// Builds the Firefox copy of the extension into dist/firefox from extension/.
// The Chrome manifest is the source of truth; this swaps in what Firefox needs:
// event-page background scripts, a fixed add-on id (the Drop helper allows it by id),
// and drops the Chrome-only Boost capture permissions (Boost uses its in-page engine).
//   node scripts/build-firefox.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GECKO_ID = 'kit@1619.in';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'firefox');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'extension'), out, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
delete manifest.key;
delete manifest.minimum_chrome_version;
manifest.background = { scripts: [manifest.background.service_worker], type: 'module' };
manifest.permissions = manifest.permissions.filter((p) => p !== 'offscreen' && p !== 'tabCapture');
manifest.browser_specific_settings = {
  gecko: { id: GECKO_ID, strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } },
};
fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Firefox build: ${path.relative(root, out)}`);
