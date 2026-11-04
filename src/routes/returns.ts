import express from 'express';
import type { AppContext } from '../context.js';
import { notFound } from '../lib/errors.js';
import { paginate } from '../lib/pagination.js';
import { createReturn } from '../services/returns.js';
import { createReturnSchema } from '../validation/schemas.js';

export function returnsRouter(ctx: AppContext) {
  const router = express.Router();

  // Start a return for items on a shipped order. Choose a refund, store credit or an exchange; the
  // response includes the prepaid return label to send the customer.
  router.post('/returns', (req, res) => {
    const input = createReturnSchema.parse(req.body);
    res.status(201).json(createReturn(ctx, input));
  });

  router.get('/returns', (req, res) => {
    res.json(paginate(ctx.store.returns.values(), req.query));
  });

  router.get('/returns/:id', (req, res) => {
    const found = ctx.store.returns.get(req.params.id);
    if (!found) throw notFound('return', req.params.id);
    res.json(found);
  });

  return router;
}
