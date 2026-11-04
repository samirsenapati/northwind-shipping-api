import { createApp } from './app.js';
import { config } from './config.js';
import { createContext } from './context.js';
import { startTrackingSimulator } from './jobs/trackingSimulator.js';

const ctx = createContext();
const app = createApp(ctx);
startTrackingSimulator(ctx);

const server = app.listen(config.port, () => {
  console.log(`Northwind API listening on http://localhost:${config.port} (${config.env})`);
  console.log(`Test key: ${config.testApiKey.slice(0, 12)}…  Try: curl localhost:${config.port}/health`);
});

// Finish in-flight webhook deliveries before exiting on a deploy or Ctrl+C.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    void ctx.webhooks.idle().then(() => process.exit(0));
  });
}
