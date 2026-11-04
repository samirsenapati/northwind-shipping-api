import type { RequestHandler, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import type { ApiKey } from '../models/types.js';
import type { MemoryStore } from '../store/memoryStore.js';

const BEARER_KEY = /^Bearer\s+(nw_(?:test|live)_[A-Za-z0-9]+)$/;

// Every /v1 request authenticates with `Authorization: Bearer <key>`. The key decides the mode:
// nw_test_ keys work on test data with free labels, nw_live_ keys buy real ones.
export function authenticate(store: MemoryStore): RequestHandler {
  return (req, res, next) => {
    const header = req.get('authorization');
    if (!header) {
      return next(new ApiError('authentication_error', 'missing_api_key', 'Send your API key in the Authorization header: Bearer <key>.'));
    }
    const match = BEARER_KEY.exec(header.trim());
    if (!match) {
      return next(new ApiError('authentication_error', 'malformed_api_key', 'API keys start with nw_test_ or nw_live_ and follow the word Bearer.'));
    }
    const key = store.apiKeys.get(match[1]);
    if (!key) {
      return next(new ApiError('authentication_error', 'invalid_api_key', 'This API key does not exist or was deleted. Check Settings > API keys.'));
    }
    res.locals.apiKey = key;
    next();
  };
}

export const currentKey = (res: Response): ApiKey => res.locals.apiKey as ApiKey;
