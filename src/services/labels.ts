import { config, DAY_SECONDS } from '../config.js';
import type { AppContext } from '../context.js';
import { ApiError, invalid, notFound } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import type { Label, Mode, Shipment, Tracker } from '../models/types.js';
import { carrierNamed } from './carriers/index.js';

const isoDate = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);

/** Buys the label for one of the shipment's rates and starts tracking it. */
export function buyLabel(ctx: AppContext, shipment: Shipment, rateId: string): Label {
  if (shipment.label && shipment.label.status !== 'voided') {
    throw invalid('label_already_purchased', `Shipment ${shipment.id} already has label ${shipment.label.id}. Void it before buying another.`);
  }
  const rate = shipment.rates.find(r => r.id === rateId);
  if (!rate) {
    throw invalid('rate_not_found', `Rate ${rateId} does not belong to shipment ${shipment.id}. Use an ID from its rates.`, 'rate_id');
  }
  const carrier = carrierNamed(rate.carrier);
  if (!carrier) {
    throw new ApiError('carrier_error', 'carrier_unavailable', `${rate.carrier} is no longer connected. Choose a rate from another carrier.`);
  }

  const now = ctx.now();
  const format = shipment.options.label_format ?? 'pdf';
  const purchased = carrier.purchase(rate.service, format);
  const label: Label = {
    id: newId('label'),
    object: 'label',
    shipment_id: shipment.id,
    status: 'purchased',
    carrier: rate.carrier,
    service: rate.service,
    tracking_number: purchased.trackingNumber,
    label_url: purchased.labelUrl,
    format,
    // Test labels are free and cannot be shipped.
    amount: shipment.mode === 'test' ? '0.00' : rate.amount,
    currency: rate.currency,
    created: now,
  };
  const tracker: Tracker = {
    id: newId('tracker'),
    object: 'tracker',
    shipment_id: shipment.id,
    tracking_number: label.tracking_number,
    carrier: label.carrier,
    status: 'label_created',
    estimated_delivery: isoDate(now + rate.delivery_days * DAY_SECONDS),
    events: [carrier.initialEvent(now)],
  };

  ctx.store.labels.set(label.id, label);
  ctx.store.trackers.set(tracker.tracking_number, tracker);
  shipment.label = label;
  shipment.status = 'purchased';
  ctx.webhooks.emit('label.purchased', label);
  return label;
}

export function findLabel(ctx: AppContext, id: string, mode: Mode): Label {
  const label = ctx.store.labels.get(id);
  const shipment = label && ctx.store.shipments.get(label.shipment_id);
  if (!label || !shipment || shipment.mode !== mode) throw notFound('label', id);
  return label;
}

// A label can be voided for a refund while the carrier has not scanned it, within 30 days of purchase.
// Live refunds wait for the carrier to confirm the label went unused (status void_requested); test labels
// cost nothing, so they are voided at once.
export function voidLabel(ctx: AppContext, label: Label): Label {
  if (label.status !== 'purchased') {
    throw invalid('label_not_voidable', label.status === 'voided' ? 'This label is already voided.' : 'A void is already in progress for this label.');
  }
  const tracker = ctx.store.trackers.get(label.tracking_number);
  if (tracker?.events.some(event => event.status !== 'label_created')) {
    throw invalid('label_already_scanned', 'The carrier has scanned this label, so it counts as used and cannot be voided.');
  }
  if (ctx.now() - label.created > config.labelVoidWindowDays * DAY_SECONDS) {
    throw invalid('void_window_expired', `Labels can be voided within ${config.labelVoidWindowDays} days of purchase.`);
  }
  if (!carrierNamed(label.carrier)?.void(label.tracking_number)) {
    throw new ApiError('carrier_error', 'void_rejected', `${label.carrier} did not accept the void. Try again in a few minutes.`);
  }

  const shipment = ctx.store.shipments.get(label.shipment_id);
  label.status = shipment?.mode === 'test' ? 'voided' : 'void_requested';
  if (shipment) shipment.status = 'voided';
  return label;
}
