import { isInternational } from './pricing.js';
import { digits, simulatedCarrier } from './simulated.js';

// DHL Express: international lanes only. Prices do not vary by US zone, so zoneFactor is 0.
export const dhl = simulatedCarrier({
  name: 'DHL Express',
  supports: isInternational,
  trackingNumber: () => digits(10),
  services: [
    { name: 'Express Worldwide', baseCents: 3650, centsPerOunce: 26, zoneFactor: 0, deliveryDays: () => 3 },
    { name: 'Economy Select', baseCents: 2290, centsPerOunce: 18, zoneFactor: 0, deliveryDays: () => 7 },
  ],
});
