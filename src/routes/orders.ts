import express from 'express';
import type { AppContext } from '../context.js';
import { notFound } from '../lib/errors.js';
import { paginate } from '../lib/pagination.js';
import { orderStatusSchema } from '../validation/schemas.js';

export function ordersRouter(ctx: AppContext) {
  const router = express.Router();

  // Orders synced from the connected stores. Filter with ?status=unfulfilled to build a pick list.
  router.get('/orders', (req, res) => {
    const status = orderStatusSchema.parse(req.query.status);
    const orders = [...ctx.store.orders.values()].filter(order => !status || order.status === status);
    res.json(paginate(orders, req.query));
  });

  router.get('/orders/:id', (req, res) => {
    const order = ctx.store.orders.get(req.params.id);
    if (!order) throw notFound('order', req.params.id);
    res.json(order);
  });

  return router;
}
