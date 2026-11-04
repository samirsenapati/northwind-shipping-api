import express from 'express';
import type { AppContext } from '../context.js';
import { currentKey } from '../middleware/auth.js';
import { findTracker } from '../services/tracking.js';

export function trackersRouter(ctx: AppContext) {
  const router = express.Router();

  // Look up a parcel by tracking number: its current status, estimated delivery and every scan so far.
  router.get('/trackers/:tracking_number', (req, res) => {
    res.json(findTracker(ctx, req.params.tracking_number, currentKey(res).mode));
  });

  return router;
}
