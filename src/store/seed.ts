import { DAY_SECONDS } from '../config.js';
import type { Address, Order } from '../models/types.js';

// Orders from one sample store, Juniper Goods, timed relative to "now" so the return-window rules
// always have one order inside the window, one outside it and one that has not shipped.

const customer = (name: string, street1: string, city: string, state: string, zip: string): Address => ({
  name, street1, city, state, zip, country: 'US',
});

export function seedOrders(now: number): Order[] {
  const daysAgo = (days: number) => now - days * DAY_SECONDS;
  const base = { object: 'order', store_id: 'store_juniper_goods', currency: 'USD' } as const;

  return [
    {
      ...base,
      id: 'ord_7Hk3Pz9Rm2',
      number: '#1042',
      status: 'fulfilled',
      financial_status: 'paid',
      customer_email: 'maya.chen@example.com',
      ship_to: customer('Maya Chen', '48 Orchard Lane', 'Portland', 'OR', '97205'),
      items: [
        { sku: 'JG-MUG-12OZ', name: 'Stoneware mug, 12 oz', quantity: 2, price: '18.00' },
        { sku: 'JG-TEA-SAMPLER', name: 'Loose-leaf tea sampler', quantity: 1, price: '24.00' },
      ],
      total: '60.00',
      fulfilled_at: daysAgo(6),
      created: daysAgo(8),
    },
    {
      ...base,
      id: 'ord_5Rf7Hy3Ns8',
      number: '#1044',
      status: 'fulfilled',
      financial_status: 'paid',
      customer_email: 'dev.patel@example.com',
      ship_to: customer('Dev Patel', '310 Larkin Street', 'San Francisco', 'CA', '94102'),
      items: [
        { sku: 'JG-THROW-OAT-L', name: 'Wool throw, oat, large', quantity: 1, price: '89.00' },
        { sku: 'JG-CANDLE-CLEAR', name: 'Cedar candle (clearance)', quantity: 2, price: '9.50', final_sale: true },
      ],
      total: '108.00',
      fulfilled_at: daysAgo(3),
      created: daysAgo(4),
    },
    {
      ...base,
      id: 'ord_9Tn2Lm6Kd4',
      number: '#1038',
      status: 'fulfilled',
      financial_status: 'paid',
      customer_email: 'sam.ortiz@example.com',
      ship_to: customer('Sam Ortiz', '22 Beacon Street', 'Boston', 'MA', '02108'),
      items: [{ sku: 'JG-BOWL-SET', name: 'Nesting bowl set', quantity: 1, price: '42.00' }],
      total: '42.00',
      fulfilled_at: daysAgo(41),
      created: daysAgo(43),
    },
    {
      ...base,
      id: 'ord_3Qw8Xc5Vb7',
      number: '#1045',
      status: 'unfulfilled',
      financial_status: 'paid',
      customer_email: 'lena.berg@example.com',
      ship_to: customer('Lena Berg', '1500 Pearl Street', 'Boulder', 'CO', '80302'),
      items: [{ sku: 'JG-MUG-12OZ', name: 'Stoneware mug, 12 oz', quantity: 4, price: '18.00' }],
      total: '72.00',
      fulfilled_at: null,
      created: daysAgo(1),
    },
  ];
}
