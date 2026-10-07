// Popup tools, in nav order: { id, label, icon, mount(view, ctx) => cleanup? }.
// To add a tool: create src/tools/<id>/, list its UI module here, and its worker /
// offscreen modules in tools/background.js and offscreen/offscreen.js if it has them.
import volume from './volume/volume.js';
import vault from './vault/vault.js';
import drop from './drop/drop.js';

export default [volume, vault, drop];
