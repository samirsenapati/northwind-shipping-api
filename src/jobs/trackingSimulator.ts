import type { AppContext } from '../context.js';
import type { TrackingStatus } from '../models/types.js';
import { recordScan } from '../services/tracking.js';

// Test mode has no real carrier scanning parcels, so this moves each test parcel one step along its
// journey every few minutes. Developers get the same tracking.updated and shipment.delivered events
// they will see in live mode. A label stays unscanned for the first step, long enough to try a void.

const STEP_SECONDS = 10 * 60;

const NEXT: Partial<Record<TrackingStatus, { status: TrackingStatus; description: string; at: 'origin' | 'destination' }>> = {
  label_created: { status: 'in_transit', description: 'Accepted at origin facility', at: 'origin' },
  in_transit: { status: 'out_for_delivery', description: 'Out for delivery', at: 'destination' },
  out_for_delivery: { status: 'delivered', description: 'Delivered, front door', at: 'destination' },
};

/** Advances every test parcel whose last scan is at least STEP_SECONDS old. Returns how many moved. */
export function advanceTestTrackers(ctx: AppContext): number {
  let moved = 0;
  for (const tracker of ctx.store.trackers.values()) {
    const shipment = ctx.store.shipments.get(tracker.shipment_id);
    const next = NEXT[tracker.status];
    const lastScan = tracker.events[tracker.events.length - 1];
    if (!shipment || shipment.mode !== 'test' || shipment.label?.status !== 'purchased' || !next) continue;
    if (ctx.now() - lastScan.occurred_at < STEP_SECONDS) continue;

    const place = next.at === 'origin' ? shipment.from_address : shipment.to_address;
    recordScan(ctx, tracker, {
      status: next.status,
      description: next.description,
      location: `${place.city}, ${place.state ?? place.country}`,
      occurred_at: ctx.now(),
    });
    moved += 1;
  }
  return moved;
}

export function startTrackingSimulator(ctx: AppContext, intervalMs = 60_000): () => void {
  const timer = setInterval(() => advanceTestTrackers(ctx), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
