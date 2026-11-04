import type { AppContext } from '../context.js';
import { notFound } from '../lib/errors.js';
import type { Mode, ShipmentStatus, Tracker, TrackingEvent, TrackingStatus } from '../models/types.js';

const SHIPMENT_STATUS_FOR: Record<TrackingStatus, ShipmentStatus> = {
  label_created: 'purchased',
  in_transit: 'in_transit',
  out_for_delivery: 'in_transit',
  delivered: 'delivered',
  exception: 'exception',
  returned_to_sender: 'returned',
};

export function findTracker(ctx: AppContext, trackingNumber: string, mode: Mode): Tracker {
  const tracker = ctx.store.trackers.get(trackingNumber);
  const shipment = tracker && ctx.store.shipments.get(tracker.shipment_id);
  if (!tracker || !shipment || shipment.mode !== mode) throw notFound('tracker', trackingNumber, 'tracking_number');
  return tracker;
}

// Records one carrier scan: appends it to the timeline, moves the shipment along, and tells subscribers.
// Every scan sends tracking.updated; deliveries and exceptions also send their own event, and exception
// events carry an exception_code so integrations can treat a customs hold differently from a bad address.
export function recordScan(ctx: AppContext, tracker: Tracker, event: TrackingEvent): void {
  tracker.events.push(event);
  tracker.status = event.status;

  const shipment = ctx.store.shipments.get(tracker.shipment_id);
  if (shipment) shipment.status = SHIPMENT_STATUS_FOR[event.status];

  ctx.webhooks.emit('tracking.updated', {
    id: tracker.id,
    shipment_id: tracker.shipment_id,
    tracking_number: tracker.tracking_number,
    carrier: tracker.carrier,
    status: tracker.status,
  });
  if (!shipment) return;
  if (event.status === 'delivered') ctx.webhooks.emit('shipment.delivered', shipment);
  if (event.status === 'exception') {
    ctx.webhooks.emit('shipment.exception', { ...shipment, exception_code: event.exception_code ?? null });
  }
}
