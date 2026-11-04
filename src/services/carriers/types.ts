import type { Address, Parcel, TrackingEvent } from '../../models/types.js';

export interface Quote {
  service: string;
  amountCents: number;
  deliveryDays: number;
}

export interface PurchasedLabel {
  trackingNumber: string;
  labelUrl: string;
}

// What every carrier integration implements. A real adapter calls the carrier's API; the simulated ones
// in this repo return deterministic prices so tests and demos are repeatable.
export interface CarrierAdapter {
  readonly name: string;
  /** Whether the carrier serves this origin-destination lane at all */
  supports(from: Address, to: Address): boolean;
  quote(from: Address, to: Address, parcels: Parcel[]): Quote[];
  purchase(service: string, format: 'pdf' | 'zpl'): PurchasedLabel;
  /** Asks the carrier to cancel an unused label; false when the carrier refuses */
  void(trackingNumber: string): boolean;
  initialEvent(now: number): TrackingEvent;
}
