import type { Address, Parcel } from '../../models/types.js';

const OUNCES_PER = { lb: 16, oz: 1, kg: 35.274, g: 0.035274 } as const;
const INCHES_PER = { in: 1, cm: 0.393701 } as const;

/** Domestic carriers bill 1 lb per 139 cubic inches when a parcel is light for its size. */
const DIM_DIVISOR = 139;

/** Billable weight in ounces across all parcels: the greater of actual and dimensional weight. */
export function billableOunces(parcels: Parcel[]): number {
  return parcels.reduce((total, parcel) => {
    const actual = parcel.weight * OUNCES_PER[parcel.weight_unit];
    let dimensional = 0;
    if (parcel.length && parcel.width && parcel.height) {
      const inches = INCHES_PER[parcel.dimension_unit ?? 'in'];
      const cubicInches = parcel.length * inches * parcel.width * inches * parcel.height * inches;
      dimensional = (cubicInches / DIM_DIVISOR) * 16;
    }
    return total + Math.max(actual, dimensional);
  }, 0);
}

/**
 * Distance band from 1 (same region) to 8 (across the country), from the first digit of each US ZIP.
 * Carriers publish exact zone charts; the first digit is close enough for quoting in this demo.
 */
export function zone(from: Address, to: Address): number {
  if (from.country !== 'US' || to.country !== 'US') return 8;
  return Math.min(8, 1 + Math.abs(Number(from.zip[0]) - Number(to.zip[0])));
}

export const isDomesticUS = (from: Address, to: Address) => from.country === 'US' && to.country === 'US';

export const isUSOrCanada = (from: Address, to: Address) =>
  ['US', 'CA'].includes(from.country) && ['US', 'CA'].includes(to.country);

export const isInternational = (from: Address, to: Address) => from.country !== to.country;
