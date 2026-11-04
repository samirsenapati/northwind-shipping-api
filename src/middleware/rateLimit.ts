import type { RequestHandler } from 'express';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { currentKey } from './auth.js';

// Fixed one-minute windows per API key: 600 requests, or 1,200 on the Scale plan. Every response says
// where the key stands; a 429 also says how many seconds to wait before retrying.
export function rateLimit(): RequestHandler {
  const windows = new Map<string, { start: number; count: number }>();

  return (_req, res, next) => {
    const key = currentKey(res);
    const limit = key.plan === 'scale' ? config.rateLimit.scalePerMinute : config.rateLimit.perMinute;
    const nowMs = Date.now();
    const windowStart = nowMs - (nowMs % 60_000);

    let window = windows.get(key.id);
    if (!window || window.start !== windowStart) {
      window = { start: windowStart, count: 0 };
      windows.set(key.id, window);
    }
    window.count += 1;

    res.set('X-RateLimit-Limit', String(limit));
    res.set('X-RateLimit-Remaining', String(Math.max(0, limit - window.count)));
    if (window.count > limit) {
      res.set('Retry-After', String(Math.ceil((windowStart + 60_000 - nowMs) / 1000)));
      return next(new ApiError('rate_limited', 'rate_limit_exceeded', `This API key has sent more than ${limit} requests this minute.`));
    }
    next();
  };
}
