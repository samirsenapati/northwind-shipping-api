import { isDomesticUS } from './pricing.js';
import { digits, simulatedCarrier } from './simulated.js';

const SEVENTY_POUNDS = 70 * 16;

// USPS: domestic US only. Every service tops out at 70 lb, as the real ones do.
export const usps = simulatedCarrier({
  name: 'USPS',
  supports: isDomesticUS,
  trackingNumber: () => `9405${digits(18)}`,
  services: [
    { name: 'Ground Advantage', baseCents: 455, centsPerOunce: 6, zoneFactor: 0.05, deliveryDays: z => (z <= 4 ? 3 : 5), maxOunces: SEVENTY_POUNDS },
    { name: 'Priority Mail', baseCents: 760, centsPerOunce: 8, zoneFactor: 0.06, deliveryDays: z => (z <= 4 ? 2 : 3), maxOunces: SEVENTY_POUNDS },
    { name: 'Priority Mail Express', baseCents: 2850, centsPerOunce: 12, zoneFactor: 0.04, deliveryDays: () => 1, maxOunces: SEVENTY_POUNDS },
  ],
});
