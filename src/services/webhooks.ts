import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { newId } from '../lib/ids.js';
import type { Event, WebhookEndpoint, WebhookEventType } from '../models/types.js';
import type { MemoryStore } from '../store/memoryStore.js';

export type WebhookSender = (url: string, body: string, headers: Record<string, string>) => Promise<number>;

export const newSigningSecret = () => `whsec_${randomBytes(24).toString('hex')}`;

// Northwind-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" keyed with the endpoint secret>.
// Signing the timestamp with the body lets receivers reject replays of an old, validly signed event.
export function signPayload(secret: string, timestamp: number, body: string): string {
  const v1 = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

/** The check a receiver runs: same HMAC over the raw bytes, constant-time compare, at most 5 minutes old. */
export function verifySignature(
  secret: string,
  header: string | undefined,
  rawBody: string | Buffer,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map(part => part.trim().split('=', 2)));
  const timestamp = Number(parts.t);
  if (!parts.v1 || !Number.isInteger(timestamp)) return false;
  if (Math.abs(now - timestamp) > config.webhooks.signatureToleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  const received = Buffer.from(parts.v1, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export const httpSender: WebhookSender = async (url, body, headers) => {
  const response = await fetch(url, {
    method: 'POST',
    body,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(config.webhooks.timeoutMs),
  });
  return response.status;
};

// Seconds before each retry; the last step repeats until WEBHOOK_MAX_RETRY_HOURS (3 days) have passed.
const RETRY_DELAYS = [60, 5 * 60, 30 * 60, 2 * 3600, 6 * 3600, 12 * 3600];

// Creates events and delivers each one to every enabled endpoint subscribed to its type. A delivery
// succeeds on any 2xx within 10 seconds; anything else is retried with backoff. Receivers must expect
// duplicates and out-of-order events, and de-duplicate on the event ID.
export class WebhookDispatcher {
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly store: MemoryStore,
    private readonly send: WebhookSender,
    private readonly now: () => number,
  ) {}

  emit<T>(type: WebhookEventType, data: T): Event<T> {
    const event: Event<T> = { id: newId('event'), object: 'event', type, created: this.now(), data };
    this.store.events.set(event.id, event);
    for (const endpoint of this.store.webhookEndpoints.values()) {
      if (endpoint.status === 'enabled' && endpoint.events.includes(type)) {
        this.track(this.deliver(endpoint, event, 0, event.created));
      }
    }
    return event;
  }

  /** Resolves once every delivery started so far has finished. Used by tests and graceful shutdown. */
  async idle(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.allSettled([...this.inFlight]);
  }

  private track(delivery: Promise<void>): void {
    this.inFlight.add(delivery);
    void delivery.finally(() => this.inFlight.delete(delivery));
  }

  private async deliver(endpoint: WebhookEndpoint, event: Event, attempt: number, firstAttemptAt: number): Promise<void> {
    if (!this.store.webhookEndpoints.has(endpoint.id)) return; // deleted while a retry was waiting

    const body = JSON.stringify(event);
    const timestamp = this.now();
    let status = 0;
    try {
      status = await this.send(endpoint.url, body, {
        'Content-Type': 'application/json',
        'User-Agent': 'Northwind-Webhooks/1.0',
        'Northwind-Signature': signPayload(endpoint.secret, timestamp, body),
      });
    } catch {
      status = 0; // timeouts and connection errors are failed attempts too
    }
    if (status >= 200 && status < 300) return;

    const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
    if (timestamp + delay - firstAttemptAt > config.webhooks.maxRetryHours * 3600) return;
    const timer = setTimeout(() => this.track(this.deliver(endpoint, event, attempt + 1, firstAttemptAt)), delay * 1000);
    timer.unref();
  }
}
