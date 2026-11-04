import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { createContext } from '../src/context.js';

export const AUTH = { Authorization: `Bearer ${config.testApiKey}` };

export const SHIPMENT = {
  to_address: { name: 'Maya Chen', street1: '48 Orchard Lane', city: 'Portland', state: 'OR', zip: '97205', country: 'US' },
  from_address: { name: 'Juniper Goods', street1: '2100 Industrial Pkwy', city: 'Columbus', state: 'OH', zip: '43215', country: 'US' },
  parcels: [{ length: 10, width: 8, height: 4, dimension_unit: 'in', weight: 2.5, weight_unit: 'lb' }],
};

export interface Delivery {
  url: string;
  body: string;
  headers: Record<string, string>;
}

/** A fresh API with its own data, an optional fixed clock, and a webhook sender that records deliveries. */
export function setup(options: { now?: () => number } = {}) {
  const sent: Delivery[] = [];
  const ctx = createContext({
    now: options.now,
    sender: async (url, body, headers) => {
      sent.push({ url, body, headers });
      return 200;
    },
  });
  return { ctx, app: createApp(ctx), sent };
}
