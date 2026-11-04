import express from 'express';
import type { AppContext } from '../context.js';
import { paginate } from '../lib/pagination.js';
import { currentKey } from '../middleware/auth.js';
import { buyLabel } from '../services/labels.js';
import { createShipment, findShipment } from '../services/shipments.js';
import { buyLabelSchema, createShipmentSchema, shipmentStatusSchema } from '../validation/schemas.js';

export function shipmentsRouter(ctx: AppContext) {
  const router = express.Router();

  // Create a shipment from addresses and parcels. The response lists a rate from every carrier that
  // serves the route, cheapest first; buy one with POST /shipments/:id/labels.
  router.post('/shipments', (req, res) => {
    const input = createShipmentSchema.parse(req.body);
    res.status(201).json(createShipment(ctx, input, currentKey(res).mode));
  });

  // List shipments, newest first. Filter with ?status=; page with ?limit= and ?starting_after=.
  router.get('/shipments', (req, res) => {
    const status = shipmentStatusSchema.parse(req.query.status);
    const mode = currentKey(res).mode;
    const shipments = [...ctx.store.shipments.values()].filter(s => s.mode === mode && (!status || s.status === status));
    res.json(paginate(shipments, req.query));
  });

  router.get('/shipments/:id', (req, res) => {
    res.json(findShipment(ctx, req.params.id, currentKey(res).mode));
  });

  // Buy the label for one of the shipment's rates. Send an Idempotency-Key so a retry cannot buy twice.
  router.post('/shipments/:id/labels', (req, res) => {
    const { rate_id } = buyLabelSchema.parse(req.body);
    const shipment = findShipment(ctx, req.params.id, currentKey(res).mode);
    res.status(201).json(buyLabel(ctx, shipment, rate_id));
  });

  return router;
}
