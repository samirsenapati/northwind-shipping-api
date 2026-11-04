import { DAY_SECONDS } from '../config.js';
import type { AppContext } from '../context.js';
import { invalid, notFound } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { formatCents } from '../lib/money.js';
import type { Mode, Pickup } from '../models/types.js';
import type { CreatePickupInput } from '../validation/schemas.js';
import { carrierNamed } from './carriers/index.js';

const MIN_LEAD_SECONDS = 2 * 60 * 60;
const MIN_WINDOW_SECONDS = 2 * 60 * 60;
const MAX_DAYS_AHEAD = 7;

// Books a carrier pickup for parcels that already have labels, so nobody has to drive to a drop-off
// point. One pickup serves one carrier at one address; the driver scans every label during the window.
export function schedulePickup(ctx: AppContext, input: CreatePickupInput, mode: Mode): Pickup {
  const now = ctx.now();
  const { start, end } = input.pickup_window;
  if (start < now + MIN_LEAD_SECONDS) {
    throw invalid('pickup_window_too_soon', 'Pickups must start at least 2 hours from now.', 'pickup_window.start');
  }
  if (start > now + MAX_DAYS_AHEAD * DAY_SECONDS) {
    throw invalid('pickup_window_too_far', `Pickups can be booked up to ${MAX_DAYS_AHEAD} days ahead.`, 'pickup_window.start');
  }
  if (end - start < MIN_WINDOW_SECONDS) {
    throw invalid('pickup_window_too_short', 'Give the driver a window of at least 2 hours.', 'pickup_window.end');
  }

  const ids = [...new Set(input.shipment_ids)];
  const shipments = ids.map((id, i) => {
    const shipment = ctx.store.shipments.get(id);
    if (!shipment || shipment.mode !== mode) throw notFound('shipment', id, `shipment_ids.${i}`);
    if (shipment.status !== 'purchased' || shipment.label?.status !== 'purchased') {
      throw invalid('shipment_not_ready', `Shipment ${id} needs a purchased label the carrier has not scanned yet.`, `shipment_ids.${i}`);
    }
    return { shipment, label: shipment.label };
  });

  const carrierName = shipments[0].label.carrier;
  shipments.forEach(({ shipment, label }, i) => {
    if (label.carrier !== carrierName) {
      throw invalid('mixed_carriers', `Shipment ${shipment.id} ships with ${label.carrier}, not ${carrierName}. Book one pickup per carrier.`, `shipment_ids.${i}`);
    }
  });
  const overlapping = [...ctx.store.pickups.values()].find(
    pickup => pickup.status === 'scheduled' && pickup.shipment_ids.some(id => ids.includes(id)),
  );
  if (overlapping) {
    throw invalid('already_scheduled', `Pickup ${overlapping.id} already collects one of these shipments.`, 'shipment_ids');
  }

  const carrier = carrierNamed(carrierName);
  if (!carrier?.schedulePickup) {
    throw invalid('pickup_not_offered', `${carrierName} does not offer scheduled pickups; drop the parcels off instead.`, 'shipment_ids');
  }
  const booking = carrier.schedulePickup({ start, end });

  const pickup: Pickup = {
    id: newId('pickup'),
    object: 'pickup',
    status: 'scheduled',
    carrier: carrierName,
    confirmation: booking.confirmation,
    shipment_ids: ids,
    address: input.address ?? shipments[0].shipment.from_address,
    window: { start, end },
    instructions: input.instructions ?? null,
    // Test pickups are never dispatched, so they are free.
    fee: { amount: mode === 'test' ? '0.00' : formatCents(booking.feeCents), currency: 'USD' },
    mode,
    created: now,
  };
  ctx.store.pickups.set(pickup.id, pickup);
  ctx.webhooks.emit('pickup.scheduled', pickup);
  return pickup;
}

export function findPickup(ctx: AppContext, id: string, mode: Mode): Pickup {
  const pickup = ctx.store.pickups.get(id);
  if (!pickup || pickup.mode !== mode) throw notFound('pickup', id);
  return pickup;
}

/** Cancels a pickup any time before its window starts; after that, only the carrier can stop the driver. */
export function cancelPickup(ctx: AppContext, pickup: Pickup): Pickup {
  if (pickup.status !== 'scheduled') throw invalid('pickup_not_cancellable', `This pickup is already ${pickup.status}.`);
  if (ctx.now() >= pickup.window.start) {
    throw invalid('pickup_window_started', 'The pickup window has started. Contact the carrier to stop the driver.');
  }
  carrierNamed(pickup.carrier)?.cancelPickup?.(pickup.confirmation);
  pickup.status = 'cancelled';
  ctx.webhooks.emit('pickup.cancelled', pickup);
  return pickup;
}
