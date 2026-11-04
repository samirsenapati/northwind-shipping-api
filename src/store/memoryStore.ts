import type { ApiKey, Event, Label, Order, Return, Shipment, Tracker, WebhookEndpoint } from '../models/types.js';
import { seedOrders } from './seed.js';

// In-memory storage, so the API starts with one command and resets on restart. Each collection is a
// plain Map; swapping in a database means re-implementing these maps, not the services that use them.
export class MemoryStore {
  readonly shipments = new Map<string, Shipment>();
  readonly labels = new Map<string, Label>();
  /** Keyed by tracking number, the identifier carriers and customers use */
  readonly trackers = new Map<string, Tracker>();
  readonly returns = new Map<string, Return>();
  readonly orders = new Map<string, Order>();
  readonly webhookEndpoints = new Map<string, WebhookEndpoint>();
  readonly events = new Map<string, Event>();
  /** Keyed by the secret the client sends */
  readonly apiKeys = new Map<string, ApiKey>();

  static seeded(keys: ApiKey[], now: number): MemoryStore {
    const store = new MemoryStore();
    for (const key of keys) store.apiKeys.set(key.secret, key);
    for (const order of seedOrders(now)) store.orders.set(order.id, order);
    return store;
  }
}
