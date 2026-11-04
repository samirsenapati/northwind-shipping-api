import express from 'express';
import type { AppContext } from '../context.js';
import { currentKey } from '../middleware/auth.js';
import { cancelPickup, findPickup, schedulePickup } from '../services/pickups.js';
import { createPickupSchema } from '../validation/schemas.js';

export function pickupsRouter(ctx: AppContext) {
  const router = express.Router();

  // Book a carrier pickup for labelled shipments that leave from the same address. The window must
  // start at least 2 hours from now, within the next 7 days, and last at least 2 hours.
  router.post('/pickups', (req, res) => {
    const input = createPickupSchema.parse(req.body);
    res.status(201).json(schedulePickup(ctx, input, currentKey(res).mode));
  });

  router.get('/pickups/:id', (req, res) => {
    res.json(findPickup(ctx, req.params.id, currentKey(res).mode));
  });

  // Cancel a pickup any time before its window starts.
  router.post('/pickups/:id/cancel', (req, res) => {
    res.json(cancelPickup(ctx, findPickup(ctx, req.params.id, currentKey(res).mode)));
  });

  return router;
}
