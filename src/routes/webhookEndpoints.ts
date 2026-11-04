import express from 'express';
import type { AppContext } from '../context.js';
import { notFound } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { paginate } from '../lib/pagination.js';
import type { WebhookEndpoint } from '../models/types.js';
import { newSigningSecret } from '../services/webhooks.js';
import { createWebhookEndpointSchema } from '../validation/schemas.js';

// Lists show only the end of each signing secret; the full secret is returned once, on creation.
const masked = (endpoint: WebhookEndpoint): WebhookEndpoint => ({ ...endpoint, secret: `whsec_…${endpoint.secret.slice(-4)}` });

export function webhookEndpointsRouter(ctx: AppContext) {
  const router = express.Router();

  // Register an HTTPS URL to receive events. Store the returned signing secret on your server and use it
  // to verify the Northwind-Signature header on every delivery.
  router.post('/webhook_endpoints', (req, res) => {
    const input = createWebhookEndpointSchema.parse(req.body);
    const endpoint: WebhookEndpoint = {
      id: newId('webhookEndpoint'),
      object: 'webhook_endpoint',
      url: input.url,
      events: input.events,
      status: 'enabled',
      secret: newSigningSecret(),
      created: ctx.now(),
    };
    ctx.store.webhookEndpoints.set(endpoint.id, endpoint);
    res.status(201).json(endpoint);
  });

  router.get('/webhook_endpoints', (req, res) => {
    res.json(paginate([...ctx.store.webhookEndpoints.values()].map(masked), req.query));
  });

  // Stops deliveries at once, including retries already scheduled for this endpoint.
  router.delete('/webhook_endpoints/:id', (req, res) => {
    const endpoint = ctx.store.webhookEndpoints.get(req.params.id);
    if (!endpoint) throw notFound('webhook endpoint', req.params.id);
    ctx.store.webhookEndpoints.delete(endpoint.id);
    res.json({ id: endpoint.id, object: 'webhook_endpoint', deleted: true });
  });

  return router;
}
