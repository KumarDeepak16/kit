import { serve, namespaced } from '../lib/messaging.js';
import volume from '../tools/volume/volume.offscreen.js';

// Offscreen modules: { id, handlers, idle() } — idle() tells the worker whether the document can close.
const modules = [volume];

serve('offscreen', {
  ...namespaced(modules),
  'core:idle': () => modules.every((m) => m.idle()),
});
