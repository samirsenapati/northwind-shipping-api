import { config } from './config.js';
import type { ApiKey } from './models/types.js';
import { httpSender, WebhookDispatcher, type WebhookSender } from './services/webhooks.js';
import { MemoryStore } from './store/memoryStore.js';

// Everything a request handler needs, passed in rather than imported as globals, so each test builds
// its own isolated API with its own clock and webhook sender.
export interface AppContext {
  store: MemoryStore;
  webhooks: WebhookDispatcher;
  /** Current time in Unix seconds */
  now: () => number;
}

export interface ContextOptions {
  store?: MemoryStore;
  sender?: WebhookSender;
  now?: () => number;
}

function configuredApiKeys(): ApiKey[] {
  const keys: ApiKey[] = [{ id: 'key_test', secret: config.testApiKey, mode: 'test', plan: 'growth' }];
  if (config.liveApiKey) keys.push({ id: 'key_live', secret: config.liveApiKey, mode: 'live', plan: 'growth' });
  return keys;
}

export function createContext(options: ContextOptions = {}): AppContext {
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const store = options.store ?? MemoryStore.seeded(configuredApiKeys(), now());
  return { store, now, webhooks: new WebhookDispatcher(store, options.sender ?? httpSender, now) };
}
