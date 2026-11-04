import express from 'express';
import type { AppContext } from '../context.js';
import { currentKey } from '../middleware/auth.js';
import { findLabel, voidLabel } from '../services/labels.js';

export function labelsRouter(ctx: AppContext) {
  const router = express.Router();

  // Void an unused label for a refund: allowed until the carrier scans it, within 30 days of purchase.
  router.post('/labels/:id/void', (req, res) => {
    const label = findLabel(ctx, req.params.id, currentKey(res).mode);
    res.json(voidLabel(ctx, label));
  });

  return router;
}
