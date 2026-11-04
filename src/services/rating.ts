import { invalid } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { formatCents, toCents } from '../lib/money.js';
import type { Address, Parcel, Rate, ShipmentOptions } from '../models/types.js';
import { carriers } from './carriers/index.js';

const SIGNATURE_CENTS = 310;

/** Insurance costs 1% of the declared value, with a $1.00 minimum. */
export function insuranceCents(insuranceAmount?: string): number {
  if (!insuranceAmount) return 0;
  return Math.max(100, Math.round(toCents(insuranceAmount) / 100));
}

// Rate shopping: ask every carrier that serves the lane, add the chosen options to each quote, and sort
// cheapest first (faster first on a tie), which is the order the dashboard shows them in.
export function rateShipment(from: Address, to: Address, parcels: Parcel[], options: ShipmentOptions): Rate[] {
  const extras = (options.signature ? SIGNATURE_CENTS : 0) + insuranceCents(options.insurance_amount);

  const rates = carriers
    .filter(carrier => carrier.supports(from, to))
    .flatMap(carrier =>
      carrier.quote(from, to, parcels).map(
        (quote): Rate => ({
          id: newId('rate'),
          carrier: carrier.name,
          service: quote.service,
          amount: formatCents(quote.amountCents + extras),
          currency: 'USD',
          delivery_days: quote.deliveryDays,
        }),
      ),
    );

  if (rates.length === 0) {
    throw invalid('no_rates_available', 'No connected carrier serves this route for these parcels.', 'to_address');
  }
  return rates.sort((a, b) => toCents(a.amount) - toCents(b.amount) || a.delivery_days - b.delivery_days);
}
