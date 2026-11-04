import { dhl } from './dhl.js';
import { fedex } from './fedex.js';
import type { CarrierAdapter } from './types.js';
import { ups } from './ups.js';
import { usps } from './usps.js';

/** Carriers connected to this account, in the order rates are requested. */
export const carriers: CarrierAdapter[] = [usps, ups, fedex, dhl];

export const carrierNamed = (name: string): CarrierAdapter | undefined => carriers.find(carrier => carrier.name === name);

export { usps };
