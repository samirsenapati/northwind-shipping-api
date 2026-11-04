import express from 'express';
import { createContext, type AppContext } from './context.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundRoute } from './middleware/errorHandler.js';
import { idempotency } from './middleware/idempotency.js';
import { rateLimit } from './middleware/rateLimit.js';
import { v1Router } from './routes/index.js';

// Builds the HTTP app. Order matters on /v1: authenticate first (the key decides the mode and the rate
// limit), then count the request, then parse the body, then replay idempotent retries.
export function createApp(ctx: AppContext = createContext()) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/v1', authenticate(ctx.store), rateLimit(), express.json({ limit: '1mb' }), idempotency(), v1Router(ctx));

  app.use(notFoundRoute);
  app.use(errorHandler);
  return app;
}
