import { randomInt } from 'node:crypto';
import type { Address } from '../../models/types.js';
import { billableOunces, zone } from './pricing.js';
import type { CarrierAdapter } from './types.js';

export interface ServiceSpec {
  name: string;
  baseCents: number;
  centsPerOunce: number;
  /** Surcharge per zone step, as a fraction of the price (0.06 = 6% per zone) */
  zoneFactor: number;
  deliveryDays: (zone: number) => number;
  maxOunces?: number;
}

export interface CarrierSpec {
  name: string;
  supports: (from: Address, to: Address) => boolean;
  trackingNumber: () => string;
  services: ServiceSpec[];
  /** Scheduled pickups, when the carrier offers them */
  pickup?: { feeCents: number; confirmationPrefix: string };
}

/** A carrier with a published rate card instead of a live API. */
export function simulatedCarrier(spec: CarrierSpec): CarrierAdapter {
  const { pickup } = spec;
  return {
    name: spec.name,
    supports: spec.supports,

    quote(from, to, parcels) {
      const ounces = billableOunces(parcels);
      const z = zone(from, to);
      return spec.services
        .filter(service => !service.maxOunces || ounces <= service.maxOunces)
        .map(service => ({
          service: service.name,
          amountCents: Math.round((service.baseCents + service.centsPerOunce * ounces) * (1 + service.zoneFactor * (z - 1))),
          deliveryDays: service.deliveryDays(z),
        }));
    },

    purchase(_service, format) {
      const trackingNumber = spec.trackingNumber();
      return { trackingNumber, labelUrl: `https://labels.northwind.example/${trackingNumber}.${format}` };
    },

    void: () => true,

    initialEvent: now => ({
      status: 'label_created',
      description: `Shipping label created, ${spec.name} awaiting item`,
      location: null,
      occurred_at: now,
    }),

    schedulePickup: pickup
      ? () => ({ confirmation: `${pickup.confirmationPrefix}${digits(9)}`, feeCents: pickup.feeCents })
      : undefined,
    cancelPickup: pickup ? () => true : undefined,
  };
}

export const digits = (count: number): string => Array.from({ length: count }, () => randomInt(10)).join('');

export const letters = (count: number): string =>
  Array.from({ length: count }, () => 'ABCDEFGHJKLMNPRSTUVWXYZ'[randomInt(23)]).join('');
