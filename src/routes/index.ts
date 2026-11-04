import express from 'express';
import type { AppContext } from '../context.js';
import { labelsRouter } from './labels.js';
import { ordersRouter } from './orders.js';
import { pickupsRouter } from './pickups.js';
import { returnsRouter } from './returns.js';
import { shipmentsRouter } from './shipments.js';
import { trackersRouter } from './trackers.js';
import { webhookEndpointsRouter } from './webhookEndpoints.js';

/** Every /v1 resource. Paths inside each router are relative to /v1. */
export function v1Router(ctx: AppContext) {
  const router = express.Router();
  router.use(shipmentsRouter(ctx));
  router.use(labelsRouter(ctx));
  router.use(trackersRouter(ctx));
  router.use(pickupsRouter(ctx));
  router.use(returnsRouter(ctx));
  router.use(ordersRouter(ctx));
  router.use(webhookEndpointsRouter(ctx));
  return router;
}
