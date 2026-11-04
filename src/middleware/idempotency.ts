import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { config } from '../config.js';
import { invalid } from '../lib/errors.js';
import { currentKey } from './auth.js';

interface SavedResponse {
  fingerprint: string;
  status: number;
  body: unknown;
  expiresAt: number;
}

// Any POST may carry an Idempotency-Key. The first response for a key is saved for 24 hours and replayed
// for retries, so a request retried after a timeout never buys the same label twice. Server errors are not
// saved (a retry should run again), and rate-limited requests never reach this middleware.
export function idempotency(): RequestHandler {
  const saved = new Map<string, SavedResponse>();

  return (req, res, next) => {
    const idempotencyKey = req.method === 'POST' ? req.get('idempotency-key') : undefined;
    if (!idempotencyKey) return next();
    if (idempotencyKey.length > 255) {
      return next(invalid('idempotency_key_too_long', 'Idempotency-Key can be at most 255 characters.', 'Idempotency-Key'));
    }

    const scope = `${currentKey(res).id} ${req.originalUrl} ${idempotencyKey}`;
    const fingerprint = createHash('sha256').update(JSON.stringify(req.body ?? null)).digest('hex');
    const now = Date.now();
    const previous = saved.get(scope);

    if (previous && previous.expiresAt > now) {
      if (previous.fingerprint !== fingerprint) {
        return next(invalid('idempotency_key_reused', 'This Idempotency-Key was already used with a different request body.', 'Idempotency-Key'));
      }
      res.set('Idempotent-Replayed', 'true');
      return res.status(previous.status).json(previous.body);
    }

    const send = res.json.bind(res);
    res.json = body => {
      if (res.statusCode < 500) {
        saved.set(scope, { fingerprint, status: res.statusCode, body, expiresAt: now + config.idempotencyTtlSeconds * 1000 });
        if (saved.size > 50_000) for (const [k, v] of saved) if (v.expiresAt <= now) saved.delete(k);
      }
      return send(body);
    };
    next();
  };
}
