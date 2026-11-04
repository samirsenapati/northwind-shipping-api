import { isUSOrCanada } from './pricing.js';
import { digits, letters, simulatedCarrier } from './simulated.js';

// UPS: within and between the US and Canada. Tracking numbers follow the 1Z format.
export const ups = simulatedCarrier({
  name: 'UPS',
  supports: isUSOrCanada,
  trackingNumber: () => `1Z${letters(3)}${digits(3)}03${digits(8)}`,
  services: [
    { name: 'Ground', baseCents: 985, centsPerOunce: 7, zoneFactor: 0.07, deliveryDays: z => (z <= 3 ? 2 : z <= 6 ? 4 : 5) },
    { name: '2nd Day Air', baseCents: 2240, centsPerOunce: 11, zoneFactor: 0.05, deliveryDays: () => 2 },
    { name: 'Next Day Air', baseCents: 4590, centsPerOunce: 15, zoneFactor: 0.04, deliveryDays: () => 1 },
  ],
});
