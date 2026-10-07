// Service-worker side of each tool: { id, handlers?: { action(data, sender) }, init?() }.
// init() runs synchronously at worker start, so it is the place to register chrome.* listeners.
import volume from './volume/volume.bg.js';
import vault from './vault/vault.bg.js';
import drop from './drop/drop.bg.js';

export default [volume, vault, drop];
