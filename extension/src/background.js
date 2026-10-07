import { serve, namespaced } from './lib/messaging.js';
import tools from './tools/background.js';

for (const tool of tools) tool.init?.();
serve('background', namespaced(tools));
