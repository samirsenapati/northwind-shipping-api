import { isDomesticUS } from './pricing.js';
import { digits, simulatedCarrier } from './simulated.js';

// FedEx: domestic US services. Tracking numbers are 12 digits.
export const fedex = simulatedCarrier({
  name: 'FedEx',
  supports: isDomesticUS,
  trackingNumber: () => digits(12),
  pickup: { feeCents: 500, confirmationPrefix: 'FX' },
  services: [
    { name: 'Ground', baseCents: 960, centsPerOunce: 7, zoneFactor: 0.07, deliveryDays: z => (z <= 3 ? 2 : z <= 6 ? 4 : 5) },
    { name: 'Express Saver', baseCents: 2075, centsPerOunce: 10, zoneFactor: 0.05, deliveryDays: () => 3 },
    { name: 'Standard Overnight', baseCents: 4380, centsPerOunce: 14, zoneFactor: 0.04, deliveryDays: () => 1 },
  ],
});
